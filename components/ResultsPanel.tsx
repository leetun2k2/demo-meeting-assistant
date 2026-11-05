"use client";

import { useState } from "react";
import type { MeetingResult } from "@/lib/types";
import { formatClock } from "@/lib/format";

const SPEAKER_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
];

function colorForSpeaker(speaker: string, order: string[]): string {
  if (speaker === "Unknown speaker") return "bg-zinc-200 text-zinc-700";
  let idx = order.indexOf(speaker);
  if (idx === -1) {
    order.push(speaker);
    idx = order.length - 1;
  }
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

export default function ResultsPanel({ result }: { result: MeetingResult }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const speakerOrder: string[] = [];
  const json = JSON.stringify(result, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    window.setTimeout(() => setCopyStatus("idle"), 2500);
  }

  return (
    <section aria-label="Results" className="mt-10 space-y-8">
      {result.warnings?.map((w, i) => (
        <p key={i} role="status" className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {w}
        </p>
      ))}

      {result.status === "no_speech" && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">No speech detected</p>
          <p className="mt-1 text-sm text-amber-800">
            Check that your microphone captured audio, or choose a different recording.
          </p>
        </div>
      )}

      {result.status === "summary_failed" && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Transcript ready. Summary could not be generated.</p>
          {result.summaryError && <p className="mt-1 text-sm text-amber-800">{result.summaryError}</p>}
          <p className="mt-1 text-sm text-amber-800">
            Process Meeting runs transcription and summarization again from the start if you try again.
          </p>
        </div>
      )}

      {result.status === "completed" && result.summary && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Meeting Summary</h2>
            {result.summary.discussions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No discussion points identified.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {result.summary.discussions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Decisions Made</h2>
            {result.summary.decisions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No decisions identified.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {result.summary.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Action Items</h2>
            {result.summary.actionItems.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No action items identified.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="py-2 pr-4 font-medium">Assignee</th>
                      <th className="py-2 pr-4 font-medium">Task</th>
                      <th className="py-2 font-medium">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.summary.actionItems.map((item, i) => (
                      <tr key={i} className="border-b border-zinc-100 align-top">
                        <td className="py-2 pr-4 text-zinc-800">{item.assignee}</td>
                        <td className="max-w-xs break-words py-2 pr-4 text-zinc-800">{item.task}</td>
                        <td className="py-2 text-zinc-800">{item.deadline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Transcript</h2>
        {result.transcript.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No transcript available.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {result.transcript.map((seg, i) => (
              <li key={i} className="text-sm">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorForSpeaker(seg.speaker, speakerOrder)}`}
                >
                  {seg.speaker}
                </span>
                <span className="ml-2 font-mono text-xs text-zinc-400">{formatClock(seg.startMs)}</span>
                <p className="mt-1 whitespace-pre-wrap break-words text-zinc-700">{seg.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <details className="rounded-md border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">Raw JSON</summary>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Copy JSON
            </button>
            {copyStatus === "copied" && (
              <span role="status" className="text-xs text-emerald-700">
                Copied.
              </span>
            )}
            {copyStatus === "error" && (
              <span role="alert" className="text-xs text-red-700">
                Could not copy. Select the text below manually.
              </span>
            )}
          </div>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-50 p-3 text-xs text-zinc-800 select-text">
            {json}
          </pre>
        </div>
      </details>
    </section>
  );
}
