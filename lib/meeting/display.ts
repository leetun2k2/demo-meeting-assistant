import type { MeetingSummary, SpeakerNameResolution } from "@/lib/types";

const SPEAKER_LABEL_RE = /^Speaker (\d+)$/;

// Names are compared as "the same name" after trimming, Unicode-normalizing and lowercasing —
// never by stripping diacritics or guessing aliases (PRD v4 Technical Design §2).
function normalizeNameForComparison(name: string): string {
  return name.trim().normalize("NFC").toLowerCase();
}

// The single place that turns a raw speaker key (e.g. "Speaker 1") into what the UI shows.
// Every transcript/action-item render must go through this so a resolved name (or the
// "Person N" fallback) is consistent everywhere by construction, not by convention (PRD AC-05).
// Anything that isn't a raw "Speaker N" key (e.g. "Unknown", an already-resolved free-text
// name from a manual edit) passes through unchanged.
//
// When two or more speakers genuinely resolve to the same name, each is shown suffixed with its
// own speaker number (e.g. "Alex (Person 1)", "Alex (Person 2)") so the UI never silently
// collapses two different real people into one displayed identity (PRD v4 FR-01 rule 4).
export function displaySpeaker(label: string, speakerNames: SpeakerNameResolution[]): string {
  const match = SPEAKER_LABEL_RE.exec(label);
  const resolved = speakerNames.find((s) => s.speakerLabel === label)?.resolvedName;
  if (resolved) {
    const key = normalizeNameForComparison(resolved);
    const sharedByMultiple =
      speakerNames.filter((s) => s.resolvedName && normalizeNameForComparison(s.resolvedName) === key).length > 1;
    return sharedByMultiple && match ? `${resolved} (Person ${match[1]})` : resolved;
  }
  return match ? `Person ${match[1]}` : label;
}

// Matches a bare "Speaker N"/"Person N" mention, or an existing "(Person N)" disambiguation
// suffix already attached to a resolved name (e.g. "Alex (Person 1)"). The suffix form is
// captured so it can be left untouched instead of being re-processed as a second bare mention,
// which would otherwise nest a duplicate suffix onto already-normalized text.
const SPEAKER_MENTION_RE = /\((?:Speaker|Person) \d+\)|\b(?:Speaker|Person) \d+\b/g;

// The model sometimes refers to a speaker inside free-text fields (executive summary, key
// moments, etc.) using the raw label it saw in the transcript prompt, or the "Person N"
// fallback form, instead of the resolved-name convention used everywhere else on the page.
// Rewrite any such mention — in a single pass — so prose stays consistent with the Transcript
// and Action Items (FR-02 rule 6: a resolved name "must apply to the transcript, action items
// and related content"). A third party's real name is never a "Speaker N"/"Person N" token, so
// it is never touched by this replacement.
export function normalizeSpeakerMentions(text: string, speakerNames: SpeakerNameResolution[]): string {
  return text.replace(SPEAKER_MENTION_RE, (match) => {
    if (match.startsWith("(")) return match; // already an attached disambiguation suffix
    const num = /\d+/.exec(match)?.[0];
    return num ? displaySpeaker(`Speaker ${num}`, speakerNames) : match;
  });
}

// Applies normalizeSpeakerMentions to every free-text field of a parsed summary. Structured
// fields (ActionItem.assignee, TranscriptSegment.speaker) are deliberately left as raw keys
// and mapped at render/export time instead — see displaySpeaker above.
export function applySpeakerNamesToSummary(summary: MeetingSummary): MeetingSummary {
  const n = (text: string) => normalizeSpeakerMentions(text, summary.speakerNames);
  return {
    ...summary,
    themes: summary.themes.map(n),
    keyTakeaways: summary.keyTakeaways.map(n),
    title: n(summary.title),
    executiveSummary: n(summary.executiveSummary),
    discussions: summary.discussions.map(n),
    decisions: summary.decisions.map((d) => ({ ...d, text: n(d.text) })),
    risks: summary.risks.map((r) => ({ ...r, text: n(r.text) })),
    unresolvedQuestions: summary.unresolvedQuestions.map((q) => ({ ...q, text: n(q.text) })),
    keyMoments: summary.keyMoments.map((m) => ({ ...m, title: n(m.title), description: n(m.description) })),
    nextSteps: summary.nextSteps.map(n),
    followUpEmail: { subject: n(summary.followUpEmail.subject), body: n(summary.followUpEmail.body) },
  };
}
