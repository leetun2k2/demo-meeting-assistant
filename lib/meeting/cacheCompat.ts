import { buildSpeakerNameTable } from "@/lib/meeting/speakerNames";
import { normalizeSpeakerMentions } from "@/lib/meeting/display";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isWellShapedSpeakerNameArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.speakerLabel === "string" &&
        (item.resolvedName === null || typeof item.resolvedName === "string"),
    )
  );
}

function normalizeProseFields(
  summary: Record<string, unknown>,
  speakerNames: ReturnType<typeof buildSpeakerNameTable>,
): Record<string, unknown> {
  const n = (val: unknown): unknown => (typeof val === "string" ? normalizeSpeakerMentions(val, speakerNames) : val);
  const nList = (val: unknown): unknown => (Array.isArray(val) ? val.map((item) => (typeof item === "string" ? n(item) : item)) : val);
  const nInsightList = (val: unknown): unknown =>
    Array.isArray(val)
      ? val.map((item) => (isRecord(item) && typeof item.text === "string" ? { ...item, text: n(item.text) } : item))
      : val;
  const nMoments = (val: unknown): unknown =>
    Array.isArray(val)
      ? val.map((item) =>
          isRecord(item)
            ? {
                ...item,
                ...(typeof item.title === "string" ? { title: n(item.title) } : {}),
                ...(typeof item.description === "string" ? { description: n(item.description) } : {}),
              }
            : item,
        )
      : val;
  const nEmail = (val: unknown): unknown =>
    isRecord(val)
      ? {
          ...val,
          ...(typeof val.subject === "string" ? { subject: n(val.subject) } : {}),
          ...(typeof val.body === "string" ? { body: n(val.body) } : {}),
        }
      : val;

  return {
    ...summary,
    speakerNames,
    ...(typeof summary.title === "string" ? { title: n(summary.title) } : {}),
    ...(typeof summary.executiveSummary === "string" ? { executiveSummary: n(summary.executiveSummary) } : {}),
    ...(summary.themes !== undefined ? { themes: nList(summary.themes) } : {}),
    ...(summary.keyTakeaways !== undefined ? { keyTakeaways: nList(summary.keyTakeaways) } : {}),
    ...(summary.discussions !== undefined ? { discussions: nList(summary.discussions) } : {}),
    ...(summary.decisions !== undefined ? { decisions: nInsightList(summary.decisions) } : {}),
    ...(summary.risks !== undefined ? { risks: nInsightList(summary.risks) } : {}),
    ...(summary.unresolvedQuestions !== undefined ? { unresolvedQuestions: nInsightList(summary.unresolvedQuestions) } : {}),
    ...(summary.keyMoments !== undefined ? { keyMoments: nMoments(summary.keyMoments) } : {}),
    ...(summary.nextSteps !== undefined ? { nextSteps: nList(summary.nextSteps) } : {}),
    ...(summary.followUpEmail !== undefined ? { followUpEmail: nEmail(summary.followUpEmail) } : {}),
  };
}

// Backfills a schemaVersion-3 cached result's speakerNames table before strict validation, so a
// cache written before this table existed — or one missing an entry for some raw label — can
// still be restored with a safe null fallback instead of being rejected outright (PRD v4 FR-02,
// Technical Design §3). Also re-applies normalizeSpeakerMentions across prose fields to ensure
// cached summaries stay consistent with the speaker names table on reload (FR-02, AC-05/08).
// A speakerNames field with the wrong shape entirely (not an array of {speakerLabel, resolvedName}
// pairs) is left untouched so isStoredMeetingResult still rejects it exactly as before — this
// only ever completes an *incomplete* table, never papers over a malformed one. Idempotent:
// normalizing an already-normalized table and prose returns identical content.
export function normalizeStoredSpeakerNames(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 3) return value;
  if (!isRecord(value.summary) || !Array.isArray(value.transcript)) return value;

  const rawSpeakerNames = value.summary.speakerNames;
  if (rawSpeakerNames !== undefined && !isWellShapedSpeakerNameArray(rawSpeakerNames)) return value;

  const knownLabels = Array.from(
    new Set(
      value.transcript
        .map((seg) => (isRecord(seg) && typeof seg.speaker === "string" ? seg.speaker : null))
        .filter((label): label is string => label !== null),
    ),
  );

  const normalized = buildSpeakerNameTable(rawSpeakerNames ?? [], knownLabels);
  return { ...value, summary: normalizeProseFields(value.summary, normalized) };
}
