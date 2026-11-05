import { SUMMARY_TEXT_CHAR_LIMIT } from "@/lib/constants";
import type { TranscriptSegment } from "@/lib/types";

// Shared by the summary and Ask AI routes (server) and the results UI (client) so "is this
// transcript too large to summarize/ask about" is computed the same way everywhere: the byte
// length Gemini effectively sees is approximated by JSON.stringify length, per PRD FR-04/FR-06.
// Exactly SUMMARY_TEXT_CHAR_LIMIT characters is allowed.
export function serializedTranscriptLength(transcript: TranscriptSegment[]): number {
  return JSON.stringify(transcript).length;
}

export function isWithinSummaryTextLimit(transcript: TranscriptSegment[]): boolean {
  return serializedTranscriptLength(transcript) <= SUMMARY_TEXT_CHAR_LIMIT;
}
