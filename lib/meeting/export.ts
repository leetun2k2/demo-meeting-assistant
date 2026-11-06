import type { MeetingResult, MeetingSummary } from "@/lib/types";
import { displaySpeaker } from "@/lib/meeting/display";
import { formatClock } from "@/lib/format";

// Standard browser-only download: build a Blob, click a temporary <a download>, then revoke
// the object URL. No server endpoint, no download library.
export function downloadTextFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugForFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "meeting";
}

function bulletListOrNone(lines: string[]): string {
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : "None identified.";
}

export function toSummaryText(summary: MeetingSummary): string {
  return [
    summary.title,
    "",
    summary.executiveSummary,
    "",
    "Core Insights:",
    bulletListOrNone(summary.keyTakeaways),
    "",
    "Key Discussion Points:",
    bulletListOrNone(summary.discussions),
    "",
    "Decisions Made:",
    bulletListOrNone(summary.decisions.map((d) => d.text)),
  ].join("\n");
}

export function toActionItemsText(summary: MeetingSummary): string {
  if (summary.actionItems.length === 0) return "No action items identified.";
  return summary.actionItems
    .map((item) => {
      const assignee = displaySpeaker(item.assignee, summary.speakerNames);
      const status = item.status === "done" ? "Done" : "Open";
      return `- [${status}] ${item.task} — ${assignee} (${item.deadline})`;
    })
    .join("\n");
}

export function toMarkdown(result: MeetingResult): string {
  const { summary, transcript } = result;
  const lines: string[] = [];

  if (summary) {
    lines.push(`# ${summary.title}`, "", summary.executiveSummary, "");
    lines.push("## Key Discussion Points", "", bulletListOrNone(summary.discussions), "");
    lines.push("## Decisions Made", "", bulletListOrNone(summary.decisions.map((d) => d.text)), "");

    lines.push("## Action Items", "");
    if (summary.actionItems.length === 0) {
      lines.push("None identified.");
    } else {
      lines.push("| Assignee | Task | Deadline | Status |", "| --- | --- | --- | --- |");
      for (const item of summary.actionItems) {
        lines.push(
          `| ${displaySpeaker(item.assignee, summary.speakerNames)} | ${item.task} | ${item.deadline} | ${item.status} |`,
        );
      }
    }
    lines.push("");

    lines.push("## Risks & Blockers", "", bulletListOrNone(summary.risks.map((r) => r.text)), "");
    lines.push(
      "## Unresolved Questions",
      "",
      bulletListOrNone(summary.unresolvedQuestions.map((q) => q.text)),
      "",
    );
    lines.push(
      "## Key Moments",
      "",
      bulletListOrNone(summary.keyMoments.map((m) => `${formatClock(m.atMs)} — ${m.title}: ${m.description}`)),
      "",
    );
    lines.push("## Suggested Next Steps", "", bulletListOrNone(summary.nextSteps), "");
  }

  lines.push("## Transcript", "");
  if (transcript.length === 0) {
    lines.push("No transcript available.");
  } else {
    for (const seg of transcript) {
      const speaker = displaySpeaker(seg.speaker, summary?.speakerNames ?? []);
      lines.push(`**[${formatClock(seg.startMs)}] ${speaker}:** ${seg.text}`, "");
    }
  }

  return lines.join("\n");
}
