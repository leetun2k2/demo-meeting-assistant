// Shared, dependency-free constants used by both the browser workspace and the server route.

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MiB, per PRD FR-03
export const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes, per PRD FR-02/FR-03

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
  "MP3, WAV, M4A or WebM · Max 20 MiB · Recommended: 5 minutes or less.";

export const KEYS_HELPER_TEXT =
  "Your Gemini API key is saved in this browser. Audio goes to Gemini 3.5 Transcribe and the transcript goes to Gemini 3.5 Flash-Lite when you process.";

export const SWITCH_INPUT_NOTICE = "Switching input methods clears the current audio.";

// Budget for one Gemini 3.5 Flash-Lite structured-output call. Shared by the initial
// process-meeting pipeline and the summary-only retry endpoint, which both call the same
// summarizeOrFail() helper.
export const SUMMARY_BUDGET_MS = 60_000;
