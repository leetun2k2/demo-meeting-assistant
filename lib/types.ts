// "transcribed" is an intermediate state (PRD v3 FR-05/Technical Design): the transcript is
// complete and held, but no summary attempt has produced a result yet. It is distinct from
// "summary_failed", which means a summary attempt was made and failed.
export type MeetingStatus = "transcribed" | "completed" | "summary_failed" | "no_speech";

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
  themes: string[];
  keyTakeaways: string[];
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
  schemaVersion?: 3;
  processedAt?: string;
  audioDurationMs?: number;
  meetingOwner?: string;
  reviewStatus?: "open" | "complete";
  status: MeetingStatus;
  transcript: TranscriptSegment[];
  summary: MeetingSummary | null;
  summaryError?: string;
  warnings?: string[];
  // User-editable notes for this meeting (context, terminology, explicit speaker corrections),
  // editable both before Process Meeting and on the Results page (PRD v4 FR-05). Missing is
  // equivalent to "". Not treated as system instructions when sent to Gemini.
  meetingNotes?: string;
  // Snapshot of meetingNotes that produced the current `summary`, i.e. the last successful
  // summary request. Lets the UI tell the user when meetingNotes has since changed and a
  // regenerate is needed to apply it (PRD v4 FR-07). Missing means the current summary (if any)
  // was generated with empty notes.
  summaryNotes?: string;
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

// Reported by OutputPage's Generate/Retry/Regenerate action up to the Results page (PRD v4
// FR-07). Carries the notes snapshot the request was sent with alongside the outcome, since the
// page (not OutputPage) owns how a failed regenerate against an already-completed summary is
// applied: the prior summary/summaryNotes must survive, only meetingNotes always advances.
export interface SummaryRegenerateResult extends SummaryRetryResult {
  meetingNotes: string;
}
