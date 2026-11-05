import type { MeetingResult } from "@/lib/types";

// Loose runtime guard for a result restored from localStorage: the stored JSON could be from
// an older app version or hand-edited, so shape it like any other untrusted external input.
// The summary.executiveSummary check also rejects a v1-shaped cached result (whose
// `summary.decisions` was `string[]`, not today's `{text, atMs?}[]`) rather than restoring it
// into this version's Output Page with the wrong shape; a mismatch is discarded, not migrated.
export function isStoredMeetingResult(value: unknown): value is MeetingResult {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (
    !(obj.status === "completed" || obj.status === "summary_failed" || obj.status === "no_speech") ||
    !Array.isArray(obj.transcript)
  ) {
    return false;
  }
  if (obj.summary === null) return true;
  const summary = obj.summary as Record<string, unknown> | undefined;
  return typeof summary?.executiveSummary === "string";
}
