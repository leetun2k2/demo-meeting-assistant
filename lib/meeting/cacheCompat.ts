import { buildSpeakerNameTable } from "@/lib/meeting/speakerNames";

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

// Backfills a schemaVersion-3 cached result's speakerNames table before strict validation, so a
// cache written before this table existed — or one missing an entry for some raw label — can
// still be restored with a safe null fallback instead of being rejected outright (PRD v4 FR-02,
// Technical Design §3). A speakerNames field with the wrong shape entirely (not an array of
// {speakerLabel, resolvedName} pairs) is left untouched so isStoredMeetingResult still rejects it
// exactly as before — this only ever completes an *incomplete* table, never papers over a
// malformed one. Idempotent: normalizing an already-complete table returns the same table.
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
  return { ...value, summary: { ...value.summary, speakerNames: normalized } };
}
