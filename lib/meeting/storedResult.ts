import type { MeetingResult } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function isList(value: unknown, valid: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(valid);
}
function isText(value: unknown): value is string { return typeof value === "string"; }
function isInsight(value: unknown): boolean {
  return isRecord(value) && isText(value.text) && (value.atMs === undefined || isMs(value.atMs));
}

// Version 3 excludes legacy demo caches. Validate rendered fields before restoring them.
export function isStoredMeetingResult(value: unknown): value is MeetingResult {
  if (!isRecord(value) || value.schemaVersion !== 3 || !["transcribed", "completed", "summary_failed", "no_speech"].includes(String(value.status))) return false;
  if (!isList(value.transcript, (s) => isRecord(s) && isText(s.speaker) && isText(s.text) && isMs(s.startMs) && (s.endMs === undefined || isMs(s.endMs)))) return false;
  if (value.processedAt !== undefined && (!isText(value.processedAt) || !Number.isFinite(Date.parse(value.processedAt)))) return false;
  if (value.audioDurationMs !== undefined && !isMs(value.audioDurationMs)) return false;
  if (value.meetingOwner !== undefined && !isText(value.meetingOwner)) return false;
  if (value.reviewStatus !== undefined && value.reviewStatus !== "open" && value.reviewStatus !== "complete") return false;
  if (value.summaryError !== undefined && !isText(value.summaryError)) return false;
  if (value.warnings !== undefined && !isList(value.warnings, isText)) return false;
  if (value.summary === null) return value.status !== "completed";
  const summary = value.summary;
  if (!isRecord(summary) || !isText(summary.title) || !isText(summary.executiveSummary)) return false;
  return ["themes", "keyTakeaways", "discussions", "nextSteps"].every((key) => isList(summary[key], isText))
    && ["decisions", "risks", "unresolvedQuestions"].every((key) => isList(summary[key], isInsight))
    && isList(summary.speakerNames, (s) => isRecord(s) && isText(s.speakerLabel) && (s.resolvedName === null || isText(s.resolvedName)))
    && isList(summary.keyMoments, (m) => isRecord(m) && isMs(m.atMs) && isText(m.title) && isText(m.description))
    && isList(summary.actionItems, (a) => isRecord(a) && ["assignee", "task", "deadline", "status"].every((key) => isText(a[key])) && (a.priority === undefined || isText(a.priority)))
    && isRecord(summary.followUpEmail) && isText(summary.followUpEmail.subject) && isText(summary.followUpEmail.body);
}
