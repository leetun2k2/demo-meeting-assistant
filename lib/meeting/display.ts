import type { MeetingSummary, SpeakerNameResolution } from "@/lib/types";

const SPEAKER_LABEL_RE = /^Speaker (\d+)$/;

// The single place that turns a raw speaker key (e.g. "Speaker 1") into what the UI shows.
// Every transcript/action-item render must go through this so a resolved name (or the
// "Person N" fallback) is consistent everywhere by construction, not by convention (PRD AC-05).
// Anything that isn't a raw "Speaker N" key (e.g. "Unknown", an already-resolved free-text
// name from a manual edit) passes through unchanged.
export function displaySpeaker(label: string, speakerNames: SpeakerNameResolution[]): string {
  const resolved = speakerNames.find((s) => s.speakerLabel === label)?.resolvedName;
  if (resolved) return resolved;
  const match = SPEAKER_LABEL_RE.exec(label);
  return match ? `Person ${match[1]}` : label;
}

const SPEAKER_MENTION_RE = /\bSpeaker \d+\b/g;

// The model sometimes refers to a speaker inside free-text fields (executive summary, key
// moments, etc.) using the same raw label it saw in the transcript prompt, instead of the
// "Person N"/resolved-name convention used everywhere else on the page. Rewrite any such
// mention so prose stays consistent with the Transcript and Action Items (FR-02 rule 6: a
// resolved name "must apply to the transcript, action items and related content").
export function normalizeSpeakerMentions(text: string, speakerNames: SpeakerNameResolution[]): string {
  return text.replace(SPEAKER_MENTION_RE, (match) => displaySpeaker(match, speakerNames));
}

// Applies normalizeSpeakerMentions to every free-text field of a parsed summary. Structured
// fields (ActionItem.assignee, TranscriptSegment.speaker) are deliberately left as raw keys
// and mapped at render/export time instead — see displaySpeaker above.
export function applySpeakerNamesToSummary(summary: MeetingSummary): MeetingSummary {
  const n = (text: string) => normalizeSpeakerMentions(text, summary.speakerNames);
  return {
    ...summary,
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
