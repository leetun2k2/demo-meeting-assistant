import type { MeetingResult } from "@/lib/types";

// In-memory handoff of the just-processed result from the workspace ("/") to the results page
// ("/results"), mirroring audioSession.ts. This is the source of truth for a same-tab
// navigation right after Process Meeting: the results page reads it before falling back to the
// (best-effort, possibly failed-to-write) localStorage cache, so a cache write failure never
// hides the result that is still held in this tab (PRD v3 FR-05/Technical Design).
let current: MeetingResult | null = null;

export function setSessionResult(result: MeetingResult): void {
  current = result;
}

export function getSessionResult(): MeetingResult | null {
  return current;
}
