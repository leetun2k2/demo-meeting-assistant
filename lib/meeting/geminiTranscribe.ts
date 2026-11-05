import { getExtension } from "@/lib/validateAudio";
import type { TranscriptSegment } from "@/lib/types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const TRANSCRIBE_MODEL = "models/gemini-3.5-transcribe";
// Required specifically on the Interactions `interactions` call per the current Files/
// Transcribe guide's REST example; not used by file upload/get/delete.
const INTERACTIONS_API_REVISION = "2026-05-20";
// Segments split on a speaker change or a pause at least this long, per Technical Design.
const SEGMENT_GAP_MS = 2000;

export class GeminiSttError extends Error {}
export class GeminiSttTimeoutError extends GeminiSttError {}

export interface GeminiWordAnnotation {
  text: string;
  speaker?: string;
  start_offset?: string;
  end_offset?: string;
}

function authHeaders(apiKey: string): HeadersInit {
  return { "x-goog-api-key": apiKey };
}

// Google's JSON error envelope is `{"error": {"code", "message", "status"}}`. The message
// field is a sanitized human-readable explanation (not a raw payload dump or a secret), so
// surfacing it is safe and is the only way to diagnose a 4xx from the provider.
async function describeErrorResponse(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const message = body?.error?.message;
  return typeof message === "string" && message.trim() ? ` ${message}` : "";
}

async function fetchWithDeadline(url: string, init: RequestInit, deadline: number): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new GeminiSttTimeoutError("Gemini request timed out");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new GeminiSttTimeoutError("Gemini request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Browser-reported audio metadata (MediaRecorder codec parameters, generic/missing MIME
// types) is normalized to the plain audio MIME types the Transcribe guide documents,
// without transcoding the underlying bytes.
const MIME_ALIASES: Record<string, string> = {
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-m4a": "audio/m4a",
  "audio/mp4": "audio/m4a",
};
const KNOWN_GEMINI_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/m4a",
  "audio/webm",
]);
const EXTENSION_FALLBACK_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/m4a",
  webm: "audio/webm",
};

export function canonicalizeAudioMimeType(filename: string, mimeType: string): string {
  const base = (mimeType || "").split(";")[0].trim().toLowerCase();
  const aliased = MIME_ALIASES[base] ?? base;
  if (KNOWN_GEMINI_AUDIO_MIME_TYPES.has(aliased)) return aliased;

  const ext = getExtension(filename);
  const fromExtension = EXTENSION_FALLBACK_MIME[ext];
  return fromExtension ?? (aliased || "application/octet-stream");
}

export interface UploadedGeminiFile {
  name: string;
  uri: string;
}

// Gemini Files resumable upload: a start request that registers the upload and returns an
// upload URL, then one upload+finalize request carrying the bytes. The current Files guide
// does not document a file.state field to poll (unlike the previous Soniox job model), so the
// file is treated as usable for inference as soon as the finalize response returns.
export async function uploadAudio(
  apiKey: string,
  file: File,
  canonicalMimeType: string,
  deadline: number,
): Promise<UploadedGeminiFile> {
  const startRes = await fetchWithDeadline(
    GEMINI_UPLOAD_URL,
    {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(file.size),
        "X-Goog-Upload-Header-Content-Type": canonicalMimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: file.name || "audio" } }),
    },
    deadline,
  );
  if (!startRes.ok) {
    throw new GeminiSttError(`Gemini could not start the audio upload (${startRes.status}).${await describeErrorResponse(startRes)}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new GeminiSttError("Gemini upload response was missing an upload URL.");
  }

  const bytes = await file.arrayBuffer();
  const finalizeRes = await fetchWithDeadline(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "Content-Length": String(file.size),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: bytes,
    },
    deadline,
  );
  if (!finalizeRes.ok) {
    throw new GeminiSttError(
      `Gemini could not accept the audio upload (${finalizeRes.status}).${await describeErrorResponse(finalizeRes)}`,
    );
  }
  const data = await finalizeRes.json().catch(() => null);
  const fileInfo = data?.file;
  if (!fileInfo || typeof fileInfo.name !== "string" || typeof fileInfo.uri !== "string") {
    throw new GeminiSttError("Gemini upload response was missing file identifiers.");
  }
  return { name: fileInfo.name, uri: fileInfo.uri };
}

// Best-effort cleanup. Never throws; callers decide how to surface a failed attempt.
export async function deleteFile(apiKey: string, name: string, deadline: number): Promise<boolean> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const res = await fetch(`${GEMINI_API_BASE}/${name}`, {
      method: "DELETE",
      headers: authHeaders(apiKey),
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// One foreground, non-streaming Interactions request: verbatim mode with speaker diarization
// and word-level timestamps, store:false so Google does not retain an Interactions resource
// for this request. No previous_interaction_id, background mode or polling — the current
// Interactions guide documents this as a synchronous call.
//
// input[0].type/field names are confirmed against a live 400 response, not documentation:
// the fetched Transcribe guide's example showed `{type: "file", file_uri}`, but the real API
// rejects "file" (its enum includes "audio", not "file") and rejects "file_uri" as an unknown
// parameter once type is "audio". `{type: "audio", uri: fileUri}` is what the live API accepts.
export async function transcribeAudio(
  apiKey: string,
  fileUri: string,
  deadline: number,
): Promise<GeminiWordAnnotation[]> {
  const res = await fetchWithDeadline(
    `${GEMINI_API_BASE}/interactions`,
    {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
        "Api-Revision": INTERACTIONS_API_REVISION,
      },
      body: JSON.stringify({
        model: TRANSCRIBE_MODEL,
        input: [{ type: "audio", uri: fileUri }],
        store: false,
        generation_config: {
          transcription_config: {
            mode: {
              type: "verbatim",
              diarization_mode: "speaker",
              timestamp_granularities: ["word"],
            },
          },
        },
      }),
    },
    deadline,
  );
  if (!res.ok) {
    throw new GeminiSttError(`Gemini transcription request failed (${res.status}).${await describeErrorResponse(res)}`);
  }
  const data = await res.json().catch(() => null);
  if (!data) {
    throw new GeminiSttError("Gemini transcription response was unreadable.");
  }

  // Anything other than a completed interaction (blocked, truncated, or any other
  // non-terminal/non-completed status) is a transcription failure, not silence.
  if (data.status !== "completed") {
    throw new GeminiSttError(`Gemini transcription did not complete (status: ${String(data.status)}).`);
  }

  const annotations: GeminiWordAnnotation[] = [];
  const steps = Array.isArray(data.steps) ? data.steps : [];
  for (const step of steps) {
    const contents = Array.isArray(step?.content) ? step.content : [];
    for (const content of contents) {
      const contentAnnotations = Array.isArray(content?.annotations) ? content.annotations : [];
      for (const annotation of contentAnnotations) {
        if (annotation?.type === "word_info" && typeof annotation.text === "string") {
          annotations.push(annotation as GeminiWordAnnotation);
        }
      }
    }
  }
  return annotations;
}

// Duration offsets are documented as strings like "0.100s"; reject anything else rather
// than fabricate a timestamp.
function parseOffsetMs(offset: unknown): number | null {
  if (typeof offset !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(offset.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

// Groups chronological word annotations into display segments: stable "Speaker N" labels
// assigned in order of first occurrence, split on a speaker change or a >=2s pause.
// Returns an empty array when there is no recognized speech (caller maps that to no_speech).
export function normalizeTranscript(words: GeminiWordAnnotation[]): TranscriptSegment[] {
  const speechWords = words.filter((w) => typeof w.text === "string" && w.text.trim() !== "");
  if (speechWords.length === 0) return [];

  const timed = speechWords.map((w) => ({
    text: w.text,
    speaker: w.speaker,
    startMs: parseOffsetMs(w.start_offset),
    endMs: parseOffsetMs(w.end_offset),
  }));
  if (timed.some((w) => w.startMs === null)) {
    throw new GeminiSttError("Gemini transcript words were missing required timing data.");
  }

  const sorted = [...timed].sort((a, b) => (a.startMs as number) - (b.startMs as number));

  const speakerLabels = new Map<string, string>();
  let nextSpeakerNumber = 1;
  const labelFor = (rawSpeaker?: string): string => {
    if (!rawSpeaker) return "Unknown speaker";
    let label = speakerLabels.get(rawSpeaker);
    if (!label) {
      label = `Speaker ${nextSpeakerNumber}`;
      nextSpeakerNumber += 1;
      speakerLabels.set(rawSpeaker, label);
    }
    return label;
  };

  type WorkingSegment = { speaker: string; speakerKey?: string; startMs: number; endMs: number; words: string[] };
  const segments: WorkingSegment[] = [];

  for (const word of sorted) {
    const startMs = word.startMs as number;
    const endMs = word.endMs ?? startMs;
    const current = segments[segments.length - 1];
    const gap = current ? startMs - current.endMs : Infinity;
    const sameSpeaker = current?.speakerKey === word.speaker;

    if (current && sameSpeaker && gap < SEGMENT_GAP_MS) {
      current.words.push(word.text);
      current.endMs = Math.max(current.endMs, endMs);
    } else {
      segments.push({
        speaker: labelFor(word.speaker),
        speakerKey: word.speaker,
        startMs,
        endMs,
        words: [word.text],
      });
    }
  }

  return segments.map(({ speaker, startMs, words }) => ({ speaker, startMs, text: words.join(" ").trim() }));
}
