// Shared, dependency-free constants used by both the browser workspace and the server route.

// Upload limit, per PRD v3 FR-01/section 3 (100 MiB, exact threshold allowed).
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
// Live recording keeps its original byte/time caps from v1/v2; raising the upload limit must
// not silently raise how much a live recording can capture (PRD v3 section 3).
export const MAX_RECORDING_BYTES = 20 * 1024 * 1024;
export const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes, per PRD FR-02/FR-03

// Above this, the workspace warns the duration is outside the verified demo target but still
// allows the attempt (PRD v3 section 3: "mục tiêu nghiệm thu đến 60 phút").
export const DURATION_WARNING_MS = 60 * 60 * 1000;

export const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "webm"] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/webm",
] as const;

// Legacy, app-owned entry from the previous two-provider flow. Kept only so the workspace
// can best-effort remove it from localStorage on mount; its value is never read or sent.
export const SONIOX_API_KEY_STORAGE_KEY = "meeting-assistant.sonioxApiKey";
export const GEMINI_API_KEY_STORAGE_KEY = "meeting-assistant.geminiApiKey";
// Holds the most recent Process Meeting outcome, written once when it arrives and updated
// in place by action-item edits or a summary retry, so the /results page (and a reload of it)
// always has something to show. Audio itself is still never persisted.
export const LAST_RESULT_STORAGE_KEY = "meeting-assistant.lastResult";

export const UPLOAD_HELPER_TEXT =
  "MP3, WAV, M4A or WebM · Max 100 MiB · Target up to 60 minutes.";

export const KEYS_HELPER_TEXT =
  "Your Gemini API key is saved in this browser. Audio goes to Gemini 3.5 Transcribe and the transcript goes to Gemini 3.5 Flash-Lite when you process.";

export const SWITCH_INPUT_NOTICE = "Switching input methods clears the current audio.";

// Client+server budgets per PRD v3 section 3 / Technical Design. The first request covers the
// browser->server upload plus the server->Gemini Files upload plus Transcribe inference; the
// summary request is a separate, sequential call against the held transcript. The total is an
// end-of-wait deadline from the moment Process is pressed, not a guarantee every input finishes
// in time.
export const PROCESS_BUDGET_MS = 12 * 60 * 1000;
export const SUMMARY_BUDGET_MS = 120_000;
export const TOTAL_BUDGET_MS = 15 * 60 * 1000;
export const CLEANUP_BUDGET_MS = 10_000;

// Shared cap for the serialized transcript sent to the summarizer or Ask AI, per PRD FR-04/FR-06.
// Exactly this many characters is allowed; the check runs before any model call, never a silent
// truncation.
export const SUMMARY_TEXT_CHAR_LIMIT = 200_000;

// Cap on user-provided meeting notes (PRD v4 FR-05). Exactly this many characters is allowed;
// over the limit is rejected with a clear error before any model call, never cut silently.
export const NOTES_CHAR_LIMIT = 10_000;

export const NOTES_PLACEHOLDER =
  "Speaker 1 là Alex; Speaker 2 là Bob; Nexus là tên dự án.";

export const NOTES_HELPER_TEXT =
  "Optional. Add context, terminology or explicit speaker corrections (e.g. \"Speaker 1 is Alex\"). A plain list of names is not enough to identify who is speaking.";
