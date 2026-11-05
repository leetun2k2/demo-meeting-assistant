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
import { CLEANUP_BUDGET_MS, MAX_UPLOAD_BYTES, PROCESS_BUDGET_MS } from "@/lib/constants";

// Per v3 Technical Design, this route now only covers the Gemini Files upload and one
// foreground Transcribe Interactions call: it returns as soon as the transcript is ready
// (status "transcribed", summary: null) instead of also summarizing. Summarization is a
// separate, sequential call the browser makes to /api/summarize-meeting once it holds the
// transcript, so a summary failure never requires re-uploading or re-transcribing audio.
// (No route segment config is set: `cacheComponents` in next.config.ts already makes
// this handler dynamic/uncached by default, and that option rejects `runtime`/`dynamic`.)

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
  // Cheap early rejection when the client reports its size up front, so an obviously
  // oversized body does not have to be buffered into FormData just to be rejected anyway.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return errorResponse("Audio exceeds the 100 MiB limit.", 413);
  }

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
  if (!isAudioSizeAllowed(audio.size, MAX_UPLOAD_BYTES)) {
    return errorResponse("Audio exceeds the 100 MiB limit.", 413);
  }
  if (!hasAllowedAudioFormat(audio.name || "", audio.type || "")) {
    return errorResponse("Unsupported audio format. Use MP3, WAV, M4A or WebM.", 400);
  }

  const geminiApiKey: string = geminiApiKeyField;
  const warnings: string[] = [];
  const startedAt = Date.now();

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

  const canonicalMimeType = canonicalizeAudioMimeType(audio.name || "", audio.type || "");

  try {
    const transcriptionDeadline = Date.now() + PROCESS_BUDGET_MS;

    let annotations;
    try {
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
          504,
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

    // Demo evaluation metrics only (PRD v3 FR-07): byte/segment counts and stage duration.
    // Never the API key, audio bytes, or transcript text.
    console.log("process-meeting metrics:", {
      audioBytes: audio.size,
      format: canonicalMimeType,
      uploadAndTranscribeMs: Date.now() - startedAt,
      segmentCount: segments.length,
    });

    if (segments.length === 0) {
      return resultResponse({
        status: "no_speech",
        transcript: [],
        summary: null,
        ...(warnings.length ? { warnings } : {}),
      });
    }

    return resultResponse({
      status: "transcribed",
      transcript: segments,
      summary: null,
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
