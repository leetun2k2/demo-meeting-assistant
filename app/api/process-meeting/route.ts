import { NextRequest, NextResponse } from "next/server";
import { hasAllowedAudioFormat, isAudioSizeAllowed } from "@/lib/validateAudio";
import type { MeetingErrorResponse, MeetingResult } from "@/lib/types";
import {
  GeminiSttError,
  GeminiSttTimeoutError,
  canonicalizeAudioMimeType,
  deleteFile,
  normalizeTranscript,
  transcribeAudio,
  uploadAudio,
} from "@/lib/meeting/geminiTranscribe";
import { summarizeOrFail } from "@/lib/meeting/gemini";
import { SUMMARY_BUDGET_MS } from "@/lib/constants";

// A single long request matches the accepted local-demo scope: the Gemini Files upload and
// one foreground Transcribe Interactions call happen inside this handler, nothing is
// persisted, and there is no queue/worker/webhook. A failed summary can be retried afterward
// without repeating this part — see /api/summarize-meeting.
// (No route segment config is set: `cacheComponents` in next.config.ts already makes
// this handler dynamic/uncached by default, and that option rejects `runtime`/`dynamic`.)

const TRANSCRIPTION_BUDGET_MS = 180_000; // Gemini Files upload + Transcribe inference
const CLEANUP_BUDGET_MS = 10_000;

function errorResponse(message: string, status: number, warnings?: string[]): NextResponse<MeetingErrorResponse> {
  return NextResponse.json(
    { error: message, ...(warnings?.length ? { warnings } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function resultResponse(result: MeetingResult): NextResponse<MeetingResult> {
  return NextResponse.json({ ...result, schemaVersion: 3, processedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Could not read the uploaded audio.", 400);
  }

  const audio = formData.get("audio");
  const geminiApiKeyField = formData.get("geminiApiKey");

  if (!(audio instanceof File) || audio.size === 0) {
    return errorResponse("No audio was provided.", 400);
  }
  if (typeof geminiApiKeyField !== "string" || !geminiApiKeyField.trim()) {
    return errorResponse("A Gemini API key is required.", 400);
  }
  if (!isAudioSizeAllowed(audio.size)) {
    return errorResponse("Audio exceeds the 20 MiB limit.", 400);
  }
  if (!hasAllowedAudioFormat(audio.name || "", audio.type || "")) {
    return errorResponse("Unsupported audio format. Use MP3, WAV, M4A or WebM.", 400);
  }

  const geminiApiKey: string = geminiApiKeyField;
  const warnings: string[] = [];

  // Tracks the one Gemini Files resource owned by this attempt. Cleared once cleanup has
  // been attempted so the `finally` fallback below cannot double-delete.
  let fileName: string | undefined;

  async function cleanupGeminiFile(): Promise<void> {
    if (!fileName) return;
    const name = fileName;
    fileName = undefined;
    const cleanupDeadline = Date.now() + CLEANUP_BUDGET_MS;
    const cleanedUp = await deleteFile(geminiApiKey, name, cleanupDeadline).catch(() => false);
    if (!cleanedUp) warnings.push("Could not confirm cleanup of the temporary Gemini audio file.");
  }

  try {
    const transcriptionDeadline = Date.now() + TRANSCRIPTION_BUDGET_MS;

    let annotations;
    try {
      const canonicalMimeType = canonicalizeAudioMimeType(audio.name || "", audio.type || "");
      const uploaded = await uploadAudio(geminiApiKey, audio, canonicalMimeType, transcriptionDeadline);
      fileName = uploaded.name;
      annotations = await transcribeAudio(geminiApiKey, uploaded.uri, transcriptionDeadline);
    } catch (err) {
      if (err instanceof GeminiSttTimeoutError) {
        // The `finally` block below still attempts best-effort deletion of the uploaded
        // file by name; unlike the previous Soniox job model there is no separate remote
        // job whose non-terminal state would make that deletion unsafe.
        return errorResponse(
          `Transcription failed: ${err.message}`,
          502,
          ["Gemini did not finish in time; the uploaded audio file may remain until cleanup or its 48-hour expiry."],
        );
      }
      if (err instanceof GeminiSttError) {
        return errorResponse(`Transcription failed: ${err.message}`, 502);
      }
      throw err;
    }

    await cleanupGeminiFile();

    let segments;
    try {
      segments = normalizeTranscript(annotations);
    } catch (err) {
      const message = err instanceof GeminiSttError ? err.message : "Gemini transcript was malformed.";
      return errorResponse(`Transcription failed: ${message}`, 502, warnings.length ? warnings : undefined);
    }

    if (segments.length === 0) {
      return resultResponse({
        status: "no_speech",
        transcript: [],
        summary: null,
        ...(warnings.length ? { warnings } : {}),
      });
    }

    const summaryDeadline = Date.now() + SUMMARY_BUDGET_MS;
    const summaryResult = await summarizeOrFail(geminiApiKey, segments, summaryDeadline);
    return resultResponse({
      status: summaryResult.status,
      transcript: segments,
      summary: summaryResult.summary,
      ...(summaryResult.summaryError ? { summaryError: summaryResult.summaryError } : {}),
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    console.error("process-meeting failed:", err instanceof Error ? err.message : err);
    return errorResponse(
      "Something went wrong while processing the meeting.",
      500,
      warnings.length ? warnings : undefined,
    );
  } finally {
    await cleanupGeminiFile();
  }
}
