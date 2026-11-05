export type MeetingStatus = "completed" | "summary_failed" | "no_speech";

export interface TranscriptSegment {
  speaker: string;
  startMs: number;
  text: string;
}

export interface ActionItem {
  assignee: string;
  task: string;
  deadline: string;
}

export interface MeetingSummary {
  discussions: string[];
  decisions: string[];
  actionItems: ActionItem[];
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
