import type { SpeakerNameResolution } from "@/lib/types";

const PLACEHOLDER_NAME_RE = /^(?:Speaker|Person) \d+$/i;

export function isPlaceholderSpeakerName(name: string): boolean {
  return PLACEHOLDER_NAME_RE.test(name);
}

interface RawSpeakerNameEntry {
  speakerLabel?: unknown;
  resolvedName?: unknown;
}

// Builds exactly one entry per label in knownLabels (in knownLabels' order) from whatever
// {speakerLabel, resolvedName} pairs are present in rawEntries. Shared by a fresh Gemini
// response (lib/meeting/gemini.ts) and by an older cached result being backfilled
// (lib/meeting/cacheCompat.ts) so both apply the identical conflict/placeholder rules
// (PRD v4 FR-01/FR-02, Technical Design §1/§3).
//
// Rules: a label missing from rawEntries resolves to null. A blank/whitespace-only or
// placeholder ("Speaker N"/"Person N") resolvedName is treated as null. Multiple entries for the
// same label that disagree (after trimming) make that label permanently null — never "last one
// wins". Repeated entries with the identical value merge into one. A label not in knownLabels is
// dropped; a label never mentioned by the caller is never invented.
export function buildSpeakerNameTable(rawEntries: unknown, knownLabels: string[]): SpeakerNameResolution[] {
  const values = new Map<string, string | null>();
  const conflicted = new Set<string>();

  if (Array.isArray(rawEntries)) {
    for (const item of rawEntries as RawSpeakerNameEntry[]) {
      if (!item || typeof item !== "object") continue;
      const speakerLabel = typeof item.speakerLabel === "string" ? item.speakerLabel : null;
      if (!speakerLabel || !knownLabels.includes(speakerLabel)) continue;
      if (conflicted.has(speakerLabel)) continue;

      let resolvedName: string | null = null;
      if (typeof item.resolvedName === "string") {
        const trimmed = item.resolvedName.trim();
        if (trimmed && !isPlaceholderSpeakerName(trimmed)) resolvedName = trimmed;
      }

      if (values.has(speakerLabel)) {
        if (values.get(speakerLabel) !== resolvedName) {
          conflicted.add(speakerLabel);
          values.delete(speakerLabel);
        }
      } else {
        values.set(speakerLabel, resolvedName);
      }
    }
  }

  return knownLabels.map((speakerLabel) => ({
    speakerLabel,
    resolvedName: conflicted.has(speakerLabel) ? null : values.get(speakerLabel) ?? null,
  }));
}
