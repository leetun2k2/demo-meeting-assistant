"use client";

import { useEffect, useState } from "react";
import OutputPage from "@/components/OutputPage";
import { isStoredMeetingResult } from "@/lib/meeting/storedResult";
import { getSessionAudioUrl } from "@/lib/meeting/audioSession";
import { LAST_RESULT_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue, writeStoredValue } from "@/lib/storage";
import Link from "next/link";
import type { ActionItem, MeetingResult, SummaryRetryResult } from "@/lib/types";

export default function ResultsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Read once on mount: the result from localStorage (written by MeetingWorkspace right
  // before it navigated here, or by an earlier visit to this same page), and the audio URL
  // from the in-memory session singleton. If none exists, show an empty state.
  useEffect(() => {
    const raw = readStoredValue(LAST_RESULT_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredMeetingResult(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read
          setResult(parsed);
        }
      } catch {
        // Corrupted entry; ignore invalid cache
      }
    }
    setAudioUrl(getSessionAudioUrl());
    setHydrated(true);
  }, []);

  function persist(next: MeetingResult) {
    setResult(next);
    writeStoredValue(LAST_RESULT_STORAGE_KEY, JSON.stringify(next));
  }

  function handleActionItemsChange(nextActionItems: ActionItem[]) {
    if (!result?.summary) return;
    persist({ ...result, summary: { ...result.summary, actionItems: nextActionItems } });
  }

  function handleSummaryUpdate(update: SummaryRetryResult) {
    if (!result) return;
    persist({ ...result, status: update.status, summary: update.summary, summaryError: update.summaryError });
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
      </div>
    );
  }

  if (!result) return <main className="mx-auto max-w-xl p-12"><h1 className="text-2xl font-bold">No meeting results yet</h1><p className="my-4">Record or upload audio to generate results. Older saved results need to be processed again.</p><Link href="/" className="text-indigo-600 underline">Go to workspace</Link></main>;

  return (
    <OutputPage
      result={result}
      audioUrl={audioUrl}
      audioAvailable={!!audioUrl}
      onActionItemsChange={handleActionItemsChange}
      onSummaryUpdate={handleSummaryUpdate}
      onMeetingChange={(changes) => persist({ ...result, ...changes })}
    />
  );
}
