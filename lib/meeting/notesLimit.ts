import { NOTES_CHAR_LIMIT } from "@/lib/constants";

// Shared by the summarize-meeting route (server) and the workspace/results UI (client) so
// "is this notes text too long for this demo" is computed the same way everywhere, per PRD v4
// FR-05. Exactly NOTES_CHAR_LIMIT characters is allowed.
export function isWithinNotesLimit(notes: string): boolean {
  return notes.length <= NOTES_CHAR_LIMIT;
}
