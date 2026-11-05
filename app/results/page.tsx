"use client";

import { useEffect, useState } from "react";
import OutputPage from "@/components/OutputPage";
import { isStoredMeetingResult } from "@/lib/meeting/storedResult";
import { getSessionAudioUrl } from "@/lib/meeting/audioSession";
import { LAST_RESULT_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue, writeStoredValue } from "@/lib/storage";
import { WIREFRAME_V2_RESULT } from "@/lib/meeting/wireframeData";
import type { ActionItem, MeetingResult, SummaryRetryResult } from "@/lib/types";

export default function ResultsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<MeetingResult>(WIREFRAME_V2_RESULT);
  const [isDemo, setIsDemo] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Read once on mount: the result from localStorage (written by MeetingWorkspace right
  // before it navigated here, or by an earlier visit to this same page), and the audio URL
  // from the in-memory session singleton. If none exists, default to wireframe v2 content.
  useEffect(() => {
    const raw = readStoredValue(LAST_RESULT_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredMeetingResult(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read
          setResult(parsed);
          setIsDemo(false);
        }
      } catch {
        // Corrupted entry; fallback to wireframe v2 demo
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

  return (
    <OutputPage
      result={result}
      audioUrl={audioUrl}
      audioAvailable={!!audioUrl}
      onActionItemsChange={handleActionItemsChange}
      onSummaryUpdate={handleSummaryUpdate}
      isDemo={isDemo}
    />
  );
}
