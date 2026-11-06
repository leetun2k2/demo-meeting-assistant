"use client";

import { useEffect, useState } from "react";
import OutputPage from "@/components/OutputPage";
import { isStoredMeetingResult } from "@/lib/meeting/storedResult";
import { normalizeStoredSpeakerNames } from "@/lib/meeting/cacheCompat";
import { getSessionAudioUrl } from "@/lib/meeting/audioSession";
import { getSessionResult, setSessionResult } from "@/lib/meeting/resultSession";
import { LAST_RESULT_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue, removeStoredValue, writeStoredValue } from "@/lib/storage";
import Link from "next/link";
import type { ActionItem, MeetingResult, SummaryRegenerateResult } from "@/lib/types";

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
          const normalized = normalizeStoredSpeakerNames(parsed);
          if (isStoredMeetingResult(normalized)) {
            setResult(normalized);
            setSessionResult(normalized);
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

  // PRD v4 FR-07: a failed Generate/Retry/Regenerate must never destroy an already-completed
  // summary. Only a success (or a failure with nothing to lose yet) replaces status/summary;
  // a failure against a completed result keeps that summary/summaryNotes and just advances the
  // live meetingNotes value (already snapshotted into the request that just failed).
  function handleSummaryUpdate(update: SummaryRegenerateResult) {
    if (!result) return;
    if (update.status === "completed") {
      persist({
        ...result,
        status: "completed",
        summary: update.summary,
        summaryError: undefined,
        meetingNotes: update.meetingNotes,
        summaryNotes: update.meetingNotes,
      });
      return;
    }
    if (result.status === "completed" && result.summary) {
      persist({ ...result, meetingNotes: update.meetingNotes });
      return;
    }
    persist({ ...result, status: "summary_failed", summary: null, summaryError: update.summaryError, meetingNotes: update.meetingNotes });
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-semibold text-zinc-500 animate-pulse">Loading meeting workspace…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Navigation bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-indigo-100/80 bg-white/80 px-6 py-3.5 backdrop-blur-md shadow-2xs">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-900 group-hover:text-indigo-600 transition-colors">
              Nexus<span className="text-indigo-600">AI</span> Meeting Intelligence
            </span>
          </Link>
          <Link
            href="/input"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-2xs"
          >
            <span>← Back to Input</span>
          </Link>
        </header>

        {/* Empty state presentation */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="relative max-w-lg w-full overflow-hidden rounded-3xl border border-indigo-100 bg-white/90 p-8 sm:p-10 text-center shadow-xl backdrop-blur-md animate-scale-in">
            {/* Ambient lighting glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-purple-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-600 shadow-inner mb-5">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 px-3 py-1 text-xs font-bold text-indigo-700 mb-3">
                No Stored Analysis
              </span>

              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900">
                No meeting results yet
              </h1>
              <p className="mt-2.5 text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-md">
                Record live speech or upload an audio file to generate instant speaker-diarized transcripts, executive takeaways, key decisions, and action items.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-lg bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  🎙️ Live Voice Recording
                </span>
                <span className="rounded-lg bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  📁 MP3, WAV, M4A, WebM
                </span>
                <span className="rounded-lg bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                  ✨ Gemini 3.5 Intelligence
                </span>
              </div>

              <div className="mt-8">
                <Link
                  href="/input"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-98 transition-all"
                >
                  <span>Go to Meeting Workspace</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
