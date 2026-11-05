import { NextResponse } from "next/server";
import { answerMeetingQuestion, GeminiError } from "@/lib/meeting/gemini";
import type { TranscriptSegment } from "@/lib/types";
import { SUMMARY_TEXT_CHAR_LIMIT } from "@/lib/constants";
import { isWithinSummaryTextLimit } from "@/lib/meeting/textLimit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.geminiApiKey !== "string" || !body.geminiApiKey.trim()) {
    return NextResponse.json({ error: "A Gemini API key is required." }, { status: 400 });
  }
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) {
    return NextResponse.json({ error: "Provide a question of up to 2,000 characters." }, { status: 400 });
  }
  const segments: unknown = body.transcript;
  const isValidSegments = Array.isArray(segments) && segments.length > 0 && segments.every((s): s is TranscriptSegment =>
    !!s && typeof s.speaker === "string" && typeof s.text === "string" && typeof s.startMs === "number" && Number.isFinite(s.startMs) && s.startMs >= 0
  );
  if (!isValidSegments) {
    return NextResponse.json({ error: "Provide a valid meeting transcript." }, { status: 400 });
  }
  if (!isWithinSummaryTextLimit(segments as TranscriptSegment[])) {
    return NextResponse.json(
      { error: `This transcript is too large to ask about in this demo (over ${SUMMARY_TEXT_CHAR_LIMIT.toLocaleString()} characters).` },
      { status: 400 },
    );
  }
  try {
    const answer = await answerMeetingQuestion(body.geminiApiKey, segments, body.question.trim());
    return NextResponse.json({ answer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GeminiError ? error.message : "Could not answer the question. Please retry." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
