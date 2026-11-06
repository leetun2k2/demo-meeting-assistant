"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LAST_RESULT_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue } from "@/lib/storage";

export default function LandingPage() {
  const [hasPreviousResult, setHasPreviousResult] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const raw = readStoredValue(LAST_RESULT_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.summary || parsed.transcript)) {
            setHasPreviousResult(true);
          }
        } catch {
          // ignore invalid json
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-zinc-900 flex flex-col justify-between">
      {/* Aurora Ambient Background Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[450px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-400/20 via-purple-400/15 to-pink-300/15 blur-3xl animate-aurora" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-[350px] w-[350px] rounded-full bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-3xl" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-indigo-100/70 bg-white/80 backdrop-blur-md px-6 py-3.5 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-zinc-900 group-hover:text-indigo-600 transition-colors">
                Nexus<span className="text-indigo-600">AI</span> Meeting Intelligence
              </span>
              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                Focus Mode
              </span>
            </div>
          </Link>

          {/* Action links */}
          <div className="flex items-center gap-3">
            {hasPreviousResult && (
              <Link
                href="/results"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50/60 transition-all shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>View Stored Results</span>
              </Link>
            )}

            <Link
              href="/input"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-98 transition-all"
            >
              <span>Launch Workspace</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Focus Area */}
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-12 sm:py-16 text-center flex-1 flex flex-col justify-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-indigo-800 shadow-2xs backdrop-blur-xs mb-6 mx-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
          </span>
          <span>Powered by Google Gemini AI · 100% Client-Side Privacy</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900 leading-[1.2]">
          Turn Raw Meeting Audio into&nbsp;
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Actionable Intelligence
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-zinc-600 leading-relaxed">
          Record live speech or upload audio up to 2.5 hours. Get speaker-diarized transcripts, high-level executive summaries, assigned tasks, and draft follow-up emails in seconds.
        </p>

        {/* Big Focal CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/input"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-7 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-98 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span>Start Meeting Ingestion</span>
            <span className="text-white/80">→</span>
          </Link>

          <Link
            href="/results"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white/90 px-5 py-3.5 text-xs sm:text-sm font-semibold text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-2xs"
          >
            <span>Explore Results</span>
            <span className="text-zinc-400">→</span>
          </Link>
        </div>

        {/* 3-Step Chain Stepper */}
        <div className="mt-12 rounded-3xl border border-indigo-100 bg-white/90 p-5 sm:p-7 shadow-sm backdrop-blur-sm text-left">
          <div className="text-center mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              The 3-Step Workflow Chain
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 mt-0.5">
              How You Use NexusAI
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
                  1
                </span>
                <span className="font-mono text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200/60">
                  / (Overview)
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900">Explore & Understand</h3>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Review available features, architecture, and client-side privacy.
              </p>
            </div>

            {/* Step 2 */}
            <Link
              href="/input"
              className="rounded-2xl border-2 border-indigo-500 bg-white p-4 shadow-md shadow-indigo-500/10 hover:border-indigo-600 hover:scale-[1.01] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
                  2
                </span>
                <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  /input (Workspace)
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-indigo-900 group-hover:text-indigo-600 transition-colors">
                Ingest Audio & Notes →
              </h3>
              <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                Record live or upload file (up to 25MB), optionally provide up to 10,000 characters of context notes.
              </p>
            </Link>

            {/* Step 3 */}
            <Link
              href="/results"
              className="rounded-2xl border border-indigo-100 bg-zinc-50/60 p-4 hover:border-indigo-300 hover:bg-white transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700 text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  3
                </span>
                <span className="font-mono text-[10px] font-bold text-zinc-600 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                  /results (Dashboard)
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                Review Intelligence →
              </h3>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Explore diarized dialogue, audio playback, task assignees, and 1-click follow-up emails.
              </p>
            </Link>
          </div>
        </div>

        {/* 4 Feature Highlights Grid */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 shadow-2xs">
            <span className="text-lg">🎙️</span>
            <h4 className="text-xs font-bold text-zinc-900 mt-1">Multimodal Ingestion</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Live mic or audio files up to 25MB / 2.5h (MP3, WAV, M4A, WebM).</p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 shadow-2xs">
            <span className="text-lg">👥</span>
            <h4 className="text-xs font-bold text-zinc-900 mt-1">Speaker Diarization</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Distinguishes individual speakers (Alex, Bob, Alice...) with timestamps.</p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 shadow-2xs">
            <span className="text-lg">📝</span>
            <h4 className="text-xs font-bold text-zinc-900 mt-1">10,000-Char Context</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Inject agenda notes & attendee hints with real-time budget gauge.</p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 shadow-2xs">
            <span className="text-lg">🎯</span>
            <h4 className="text-xs font-bold text-zinc-900 mt-1">Action Tracking</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Extracted tasks with assignees, priority tags, and 1-click follow-up email.</p>
          </div>
        </div>

        {/* Single Privacy Guarantee Bar */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>Zero Server Storage · Gemini API key & transcripts are saved solely in your local browser session.</span>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200/80 bg-white/70 py-4 px-6 text-xs text-zinc-400">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-zinc-600">NexusAI Meeting Intelligence</span>
          <div className="flex items-center gap-4 text-zinc-500">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Overview (/)
            </Link>
            <span className="text-zinc-300">·</span>
            <Link href="/input" className="hover:text-indigo-600 font-bold text-indigo-600 transition-colors">
              Input Workspace (/input)
            </Link>
            <span className="text-zinc-300">·</span>
            <Link href="/results" className="hover:text-indigo-600 transition-colors">
              Results (/results)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
