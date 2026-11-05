import { NextResponse } from "next/server";
import { answerMeetingQuestion, GeminiError } from "@/lib/meeting/gemini";
import type { TranscriptSegment } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.geminiApiKey !== "string" || !body.geminiApiKey.trim()) {
    return NextResponse.json({ error: "A Gemini API key is required." }, { status: 400 });
  }
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) {
    return NextResponse.json({ error: "Provide a question of up to 2,000 characters." }, { status: 400 });
  }
  const segments: unknown = body.transcript;
  if (!Array.isArray(segments) || !segments.length || segments.length > 5000 || !segments.every((s): s is TranscriptSegment =>
    !!s && typeof s.speaker === "string" && typeof s.text === "string" && typeof s.startMs === "number" && Number.isFinite(s.startMs) && s.startMs >= 0
  ) || JSON.stringify(segments).length > 200000) {
    return NextResponse.json({ error: "Provide a valid meeting transcript (up to 200,000 characters)." }, { status: 400 });
  }
  try {
    const answer = await answerMeetingQuestion(body.geminiApiKey, segments, body.question.trim());
    return NextResponse.json({ answer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GeminiError ? error.message : "Could not answer the question. Please retry." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
