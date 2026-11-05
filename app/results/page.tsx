"use client";

import { useEffect, useState } from "react";
import OutputPage from "@/components/OutputPage";
import { isStoredMeetingResult } from "@/lib/meeting/storedResult";
import { getSessionAudioUrl } from "@/lib/meeting/audioSession";
import { getSessionResult, setSessionResult } from "@/lib/meeting/resultSession";
import { LAST_RESULT_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue, removeStoredValue, writeStoredValue } from "@/lib/storage";
import Link from "next/link";
import type { ActionItem, MeetingResult, SummaryRetryResult } from "@/lib/types";

export default function ResultsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cacheWarning, setCacheWarning] = useState<string | null>(null);

  // The in-memory handoff (written by MeetingWorkspace right before navigating here, or by a
  // persist() in this same tab) is the source of truth: it cannot be lost to a localStorage
  // write/quota failure. It is only empty on a fresh tab/full reload, in which case the
  // best-effort localStorage cache is the fallback.
  useEffect(() => {
    const inMemory = getSessionResult();
    if (inMemory) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read
      setResult(inMemory);
    } else {
      const raw = readStoredValue(LAST_RESULT_STORAGE_KEY);
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (isStoredMeetingResult(parsed)) {
            setResult(parsed);
            setSessionResult(parsed);
          }
        } catch {
          // Corrupted entry; ignore invalid cache
        }
      }
    }
    setAudioUrl(getSessionAudioUrl());
    setHydrated(true);
  }, []);

  function persist(next: MeetingResult) {
    setResult(next);
    setSessionResult(next);
    const ok = writeStoredValue(LAST_RESULT_STORAGE_KEY, JSON.stringify(next));
    if (!ok) {
      // Best-effort: drop the stale cached result rather than risk a future reload showing it
      // instead of `next`, which this tab still holds in memory.
      removeStoredValue(LAST_RESULT_STORAGE_KEY);
      setCacheWarning("This result could not be saved in this browser. It will stay visible in this tab, but export it before closing or reloading — a reload will not recover it.");
    } else {
      setCacheWarning(null);
    }
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
    <>
      {cacheWarning && (
        <div role="alert" className="sticky top-0 z-40 bg-amber-500 px-6 py-2 text-center text-xs font-semibold text-white">
          {cacheWarning}
        </div>
      )}
      <OutputPage
        result={result}
        audioUrl={audioUrl}
        audioAvailable={!!audioUrl}
        onActionItemsChange={handleActionItemsChange}
        onSummaryUpdate={handleSummaryUpdate}
        onMeetingChange={(changes) => persist({ ...result, ...changes })}
      />
    </>
  );
}
