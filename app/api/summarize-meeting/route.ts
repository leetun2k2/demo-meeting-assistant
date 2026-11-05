import { NextRequest, NextResponse } from "next/server";
import type { MeetingErrorResponse, SummaryRetryResult, TranscriptSegment } from "@/lib/types";
import { summarizeOrFail } from "@/lib/meeting/gemini";
import { SUMMARY_BUDGET_MS } from "@/lib/constants";

// Retries only the Gemini 3.5 Flash-Lite summarization step against a transcript the client
// already holds from a prior process-meeting attempt — no audio upload, no Transcribe call.
// This is the "no need to retry from scratch" path for a summary_failed result.
// (No route segment config needed: see process-meeting/route.ts's note on cacheComponents.)

function errorResponse(message: string, status: number): NextResponse<MeetingErrorResponse> {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isValidSegment(value: unknown): value is TranscriptSegment {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.speaker !== "string" || !o.speaker) return false;
  if (typeof o.text !== "string") return false;
  if (typeof o.startMs !== "number" || !Number.isFinite(o.startMs) || o.startMs < 0) return false;
  if (o.endMs !== undefined && (typeof o.endMs !== "number" || !Number.isFinite(o.endMs))) return false;
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Could not read the request body.", 400);
  }
  if (!body || typeof body !== "object") {
    return errorResponse("Invalid request body.", 400);
  }
  const { transcript, geminiApiKey } = body as Record<string, unknown>;

  if (typeof geminiApiKey !== "string" || !geminiApiKey.trim()) {
    return errorResponse("A Gemini API key is required.", 400);
  }
  if (!Array.isArray(transcript) || transcript.length === 0 || !transcript.every(isValidSegment)) {
    return errorResponse("A nonempty, valid transcript is required.", 400);
  }

  const deadline = Date.now() + SUMMARY_BUDGET_MS;
  const result = await summarizeOrFail(geminiApiKey, transcript as TranscriptSegment[], deadline);

  const response: SummaryRetryResult = {
    status: result.status,
    summary: result.summary,
    ...(result.summaryError ? { summaryError: result.summaryError } : {}),
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
