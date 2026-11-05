export type MeetingStatus = "completed" | "summary_failed" | "no_speech";

export interface TranscriptSegment {
  speaker: string;
  startMs: number;
  // End of the segment, when known. Used to estimate meeting duration and to support
  // jump-to-audio/jump-to-transcript; never fabricated when unavailable.
  endMs?: number;
  text: string;
}

export type ActionItemStatus = "open" | "done" | "in_progress" | "todo" | string;

export interface ActionItem {
  assignee: string;
  task: string;
  deadline: string;
  priority?: "High" | "Medium" | "Low" | string;
  // Always client-initialized to "open" when a summary is parsed; Gemini never reports this
  // (an just-extracted action item has, by construction, not yet been completed).
  status: ActionItemStatus;
}

// One entry per distinct raw speaker label (e.g. "Speaker 1") present in the transcript.
// resolvedName is null when there is insufficient evidence to attach a real name.
export interface SpeakerNameResolution {
  speakerLabel: string;
  resolvedName: string | null;
}

// A grounded insight with an optional pointer back into the transcript, expressed in the
// same millisecond convention as TranscriptSegment.startMs. The client matches atMs to the
// nearest transcript segment rather than trusting a model-produced segment index.
export interface ReferencedInsight {
  text: string;
  atMs?: number;
}

export interface KeyMoment {
  atMs: number;
  title: string;
  description: string;
}

export interface FollowUpEmail {
  subject: string;
  body: string;
}

export interface MeetingSummary {
  title: string;
  executiveSummary: string;
  speakerNames: SpeakerNameResolution[];
  discussions: string[];
  decisions: ReferencedInsight[];
  actionItems: ActionItem[];
  risks: ReferencedInsight[];
  unresolvedQuestions: ReferencedInsight[];
  keyMoments: KeyMoment[];
  nextSteps: string[];
  followUpEmail: FollowUpEmail;
}

export interface MeetingResult {
  status: MeetingStatus;
  transcript: TranscriptSegment[];
  summary: MeetingSummary | null;
  summaryError?: string;
  warnings?: string[];
}

export interface MeetingErrorResponse {
  error: string;
  warnings?: string[];
}

// Response of POST /api/summarize-meeting: a summary-only retry against an already-held
// transcript, so a failed Flash-Lite call can be retried without re-running Transcribe.
export interface SummaryRetryResult {
  status: Extract<MeetingStatus, "completed" | "summary_failed">;
  summary: MeetingSummary | null;
  summaryError?: string;
}
