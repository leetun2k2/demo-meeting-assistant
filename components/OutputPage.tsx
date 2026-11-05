"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  ActionItem,
  MeetingErrorResponse,
  MeetingResult,
  SummaryRetryResult,
} from "@/lib/types";
import { displaySpeaker } from "@/lib/meeting/display";
import { downloadTextFile, slugForFilename, toActionItemsText, toSummaryText } from "@/lib/meeting/export";
import { formatClock } from "@/lib/format";
import { GEMINI_API_KEY_STORAGE_KEY } from "@/lib/constants";
import { readStoredValue } from "@/lib/storage";
import { WIREFRAME_V2_METADATA, WIREFRAME_V2_RESULT } from "@/lib/meeting/wireframeData";

// --- SVG Icons matching wireframe v2 ---
function IconSparkles({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function IconCalendar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function IconCheckCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUsers({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconList({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function IconDocumentText({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconTarget({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconAlertTriangle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function IconChevronsRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}

function IconMessageSquare({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconBarChart({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function IconCode({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconStar({ filled = false, className = "w-4 h-4" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={`${className} ${filled ? "fill-amber-400 text-amber-400" : "text-zinc-300 hover:text-amber-400"}`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconLightning({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconHelpCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function IconLightbulb({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" x2="15" y1="18" y2="18" />
      <line x1="10" x2="14" y1="22" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function IconSend({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconJira({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2.8l4.37 4.35c2.4 2.4 2.4 6.3 0 8.7L2.8 24h4.33c2.43 0 4.4-1.95 4.4-4.35V2zm5.74 5.22c0 2.4-1.97 4.35-4.4 4.35h-4.33l4.37 4.35c2.4 2.4 2.4 6.3 0 8.7l-4.37 4.38h4.33c2.43 0 4.4-1.95 4.4-4.35V7.22zm5.73 5.22c0 2.4-1.97 4.35-4.4 4.35h-4.33l4.37 4.35c2.4 2.4 2.4 6.3 0 8.7l-4.37 4.38h4.33c2.43 0 4.4-1.95 4.4-4.35V12.44z" />
    </svg>
  );
}

function IconNotion({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.466-.373-.886-.606-1.96-.513L2.873 2.574c-.373.047-.466.28-.28.466l1.866 1.168zm.933 3.639v13.076c0 .746.42 1.026 1.213.98l14.428-.84c.793-.046.98-.56.98-1.166V6.914c0-.606-.233-.886-.84-.84l-14.894.887c-.606.046-.887.327-.887.886zm13.355 1.54c.093.42 0 .84-.42.886l-.886.14c-.373.047-.513.233-.513.56v7.792c0 .42.233.606.653.56l1.166-.093c.42-.047.513.233.373.653l-1.073 1.12c-.28.28-.653.28-1.213.28l-3.36.186c-.56.047-.7-.14-.7-.513v-.373c0-.327.187-.56.56-.607l.793-.093c.373-.047.466-.233.466-.606v-5.226l-4.34 7.091c-.28.466-.56.606-1.073.653l-2.613.14c-.467.047-.654-.186-.654-.606V9.434c0-.42.187-.653.607-.7l1.493-.093c.42-.047.56.14.56.56v5.879l4.573-7.091c.28-.42.607-.606 1.167-.653l3.033-.187c.42-.046.7.14.793.56z" />
    </svg>
  );
}

// --- Donut Chart for Speaker Breakdown ---
function DonutChart({
  breakdown,
  totalLabel = "32 min",
}: {
  breakdown: Array<{ speaker: string; percentage: number; color: string }>;
  totalLabel?: string;
}) {
  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo(() => {
    return breakdown.map((item, idx) => {
      const priorPct = breakdown.slice(0, idx).reduce((sum, b) => sum + b.percentage, 0);
      const offset = (-priorPct / 100) * circumference;
      const dash = (item.percentage / 100) * circumference;
      return { ...item, dash, offset };
    });
  }, [breakdown, circumference]);

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {slices.map((slice, idx) => (
          <circle
            key={idx}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${slice.dash} ${circumference}`}
            strokeDashoffset={slice.offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold text-zinc-900">{totalLabel}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">Total</span>
      </div>
    </div>
  );
}

interface OutputPageProps {
  result: MeetingResult;
  audioUrl: string | null;
  audioAvailable: boolean;
  onActionItemsChange: (next: ActionItem[]) => void;
  onSummaryUpdate: (next: SummaryRetryResult) => void;
  isDemo?: boolean;
}

export default function OutputPage({
  result,
  audioUrl,
  audioAvailable,
  onActionItemsChange,
  onSummaryUpdate,
  isDemo = false,
}: OutputPageProps) {
  const { transcript, summary } = result;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "insights" | "json">("summary");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [importantOnly, setImportantOnly] = useState(false);
  const [starredIndices, setStarredIndices] = useState<Set<number>>(new Set([3])); // Default starred index 3 (00:23) matching wireframe

  // Modals & Popups
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [showAddActionItemModal, setShowAddActionItemModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New action item state
  const [newTask, setNewTask] = useState("");
  const [newAssignee, setNewAssignee] = useState("Speaker 3");
  const [newDeadline, setNewDeadline] = useState("Today");
  const [newPriority, setNewPriority] = useState<"High" | "Medium" | "Low">("Medium");

  // Retry state
  const [retryingSummary, setRetryingSummary] = useState(false);

  function showToast(msg: string) {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3000);
  }

  const distinctSpeakers = useMemo(() => {
    return Array.from(new Set(transcript.map((s) => s.speaker)));
  }, [transcript]);

  // Speaker breakdown calculation
  const speakerBreakdownData = useMemo(() => {
    if (isDemo || distinctSpeakers.length === 0) {
      return WIREFRAME_V2_METADATA.speakerBreakdown;
    }
    const colorPalette = ["#475569", "#94a3b8", "#cbd5e1", "#64748b", "#334155"];
    const counts: Record<string, number> = {};
    let totalLen = 0;
    transcript.forEach((t) => {
      const len = t.text.length;
      counts[t.speaker] = (counts[t.speaker] || 0) + len;
      totalLen += len;
    });
    return Object.entries(counts).map(([spk, count], idx) => {
      const pct = totalLen > 0 ? Math.round((count / totalLen) * 100) : 0;
      const minutes = ((pct / 100) * 32).toFixed(1);
      return {
        speaker: spk,
        percentage: pct,
        duration: `${minutes} min`,
        color: colorPalette[idx % colorPalette.length],
      };
    });
  }, [isDemo, distinctSpeakers, transcript]);

  // Filtered transcript
  const filteredTranscript = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    return transcript
      .map((seg, idx) => ({ seg, idx }))
      .filter(({ seg, idx }) => {
        if (speakerFilter !== "all" && seg.speaker !== speakerFilter) return false;
        if (importantOnly && !starredIndices.has(idx)) return false;
        if (q && !seg.text.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [transcript, transcriptQuery, speakerFilter, importantOnly, starredIndices]);

  function toggleStar(idx: number) {
    setStarredIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function jumpToSegment(idx: number) {
    const seg = transcript[idx];
    if (audioAvailable && audioRef.current && seg) {
      audioRef.current.currentTime = seg.startMs / 1000;
      audioRef.current.play().catch(() => {});
    }
    const el = document.getElementById(`seg-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleToggleActionItem(idx: number) {
    if (!summary) return;
    const next = summary.actionItems.map((item, i) => {
      if (i !== idx) return item;
      const isDone = item.status === "done" || item.status === "Done";
      return { ...item, status: isDone ? "To Do" : "done" };
    });
    onActionItemsChange(next);
  }

  function handleAddActionItem(e: React.FormEvent) {
    e.preventDefault();
    if (!summary || !newTask.trim()) return;
    const newItem: ActionItem = {
      task: newTask.trim(),
      assignee: newAssignee.trim() || "Speaker 1",
      deadline: newDeadline.trim() || "Not specified",
      priority: newPriority,
      status: "To Do",
    };
    onActionItemsChange([...summary.actionItems, newItem]);
    setNewTask("");
    setShowAddActionItemModal(false);
    showToast("Added new action item");
  }

  async function handleRetrySummary() {
    const apiKey = readStoredValue(GEMINI_API_KEY_STORAGE_KEY);
    if (!apiKey) {
      showToast("Add your Gemini API key on the home page first.");
      return;
    }
    setRetryingSummary(true);
    try {
      const res = await fetch("/api/summarize-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, geminiApiKey: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast((data as MeetingErrorResponse)?.error || "Retry failed");
        return;
      }
      onSummaryUpdate(data as SummaryRetryResult);
      showToast("Summary regenerated!");
    } catch {
      showToast("Could not regenerate summary.");
    } finally {
      setRetryingSummary(false);
    }
  }

  function handleAskAi(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    const q = aiQuestion.toLowerCase();
    if (q.includes("train") || q.includes("ticket") || q.includes("travel")) {
      setAiAnswer(
        "Based on the transcript, the team agreed to take the regular train (not express) to save budget. Speaker 3 committed to booking the tickets online right away.",
      );
    } else if (q.includes("time") || q.includes("arrival") || q.includes("schedule")) {
      setAiAnswer(
        "The meeting with the client starts at 10:00 AM. The team decided to arrive before 9:30 AM (at least 30 minutes early) to set up presentation equipment.",
      );
    } else {
      setAiAnswer(
        `Regarding "${aiQuestion}": The team's consensus focuses on cost-conscious transportation, timely arrival before 9:30, and client presentation prep owned by Speaker 2 and Speaker 3.`,
      );
    }
  }

  const jsonStr = useMemo(() => JSON.stringify(result, null, 2), [result]);
  const filenameBase = summary ? slugForFilename(summary.title) : "meeting";

  // Data helpers
  const meetingTitle = summary?.title || WIREFRAME_V2_METADATA.meetingTitle;
  const heroHeading = isDemo
    ? WIREFRAME_V2_METADATA.heroHeading
    : summary?.title || "Meeting Summary & Intelligence";
  const execSummary = summary?.executiveSummary || WIREFRAME_V2_RESULT.summary?.executiveSummary || "";
  const decisionsCount = summary?.decisions.length ?? 2;
  const actionItemsCount = summary?.actionItems.length ?? 3;
  const speakersCount = distinctSpeakers.length > 0 ? distinctSpeakers.length : 3;
  const durationLabel = WIREFRAME_V2_METADATA.durationFormatted;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-zinc-900 font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl animate-fade-in">
          <IconCheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden audio element for jump-to-audio playback */}
      {audioAvailable && audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOP HEADER BAR */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/95 px-6 py-3.5 backdrop-blur-md">
          {/* Left Title & Subtitle */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
              title="Back to home"
            >
              ←
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-xs">
                <IconSparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900">Meeting Results</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  <span className="font-medium text-zinc-700">{meetingTitle}</span>
                  <span className="text-zinc-300">|</span>
                  <span className="flex items-center gap-1">
                    <IconCalendar className="w-3 h-3 text-zinc-400" />
                    {WIREFRAME_V2_METADATA.date}
                  </span>
                  <span className="text-zinc-300">|</span>
                  <span className="flex items-center gap-1">
                    <IconClock className="w-3 h-3 text-zinc-400" />
                    {durationLabel}
                  </span>
                  <span className="text-zinc-300">|</span>
                  <span className="flex items-center gap-1">
                    <IconUsers className="w-3 h-3 text-zinc-400" />
                    {speakersCount} speakers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => showToast("Owner assigned")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              <span>Assign Owner</span>
              <span className="text-[10px] text-zinc-400">⌵</span>
            </button>
            <button
              type="button"
              onClick={() => showToast("Meeting marked as complete")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark Complete</span>
            </button>
            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />
            <button
              type="button"
              onClick={() => showToast("Sending sync to connected tools...")}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs"
            >
              <IconSend className="w-3.5 h-3.5" />
              <span>Send / Sync</span>
              <span className="text-[10px] text-zinc-400">⌵</span>
            </button>
          </div>
        </header>

        {/* DASHBOARD GRID CONTENT */}
        <main className="p-6 sm:p-8 max-w-[1440px] w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT / CENTER COLUMN (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* TOP ROW: HERO SUMMARY CARD + 4 STAT CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* Hero Meeting Summary Card (7 cols) */}
                <div className="md:col-span-7 relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-white to-zinc-50/60 p-6 shadow-xs flex flex-col justify-between">
                  {/* Decorative background curve */}
                  <div className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-gradient-to-tr from-zinc-100/60 to-zinc-200/40 blur-2xl" />

                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100/90 px-3 py-1 text-xs font-semibold text-zinc-700">
                      <IconSparkles className="w-3.5 h-3.5 text-zinc-900" />
                      <span>Meeting Summary</span>
                    </div>

                    <h2 className="mt-3.5 text-lg sm:text-xl font-bold tracking-tight text-zinc-900 leading-snug">
                      {heroHeading}
                    </h2>

                    <p className="mt-2.5 text-xs sm:text-sm text-zinc-600 leading-relaxed">{execSummary}</p>
                  </div>
                </div>

                {/* 4 Stat Metric Tiles (5 cols, 2x2 grid) */}
                <div className="md:col-span-5 grid grid-cols-2 gap-3">
                  {/* Stat 1: Key Decisions */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <IconCheckCircle className="w-5 h-5 text-zinc-700" />
                      <span className="text-2xl font-bold text-zinc-900">{decisionsCount}</span>
                    </div>
                    <p className="mt-3 text-xs font-medium text-zinc-500">Key Decisions</p>
                  </div>

                  {/* Stat 2: Action Items */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <IconList className="w-5 h-5 text-zinc-700" />
                      <span className="text-2xl font-bold text-zinc-900">{actionItemsCount}</span>
                    </div>
                    <p className="mt-3 text-xs font-medium text-zinc-500">Action Items</p>
                  </div>

                  {/* Stat 3: Speakers */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <IconUsers className="w-5 h-5 text-zinc-700" />
                      <span className="text-2xl font-bold text-zinc-900">{speakersCount}</span>
                    </div>
                    <p className="mt-3 text-xs font-medium text-zinc-500">Speakers</p>
                  </div>

                  {/* Stat 4: Duration */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <IconClock className="w-5 h-5 text-zinc-700" />
                      <span className="text-xl font-bold text-zinc-900">{durationLabel}</span>
                    </div>
                    <p className="mt-3 text-xs font-medium text-zinc-500">Duration</p>
                  </div>
                </div>
              </div>

              {/* VIEW TABS PILLS */}
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-2xs w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "summary"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <IconDocumentText className="w-3.5 h-3.5" />
                  <span>Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("transcript")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "transcript"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <IconMessageSquare className="w-3.5 h-3.5" />
                  <span>Transcript</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("insights")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "insights"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <IconBarChart className="w-3.5 h-3.5" />
                  <span>Insights</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("json")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeTab === "json"
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <IconCode className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>

              {/* JSON VIEW TAB */}
              {activeTab === "json" && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <span className="font-mono text-xs font-semibold text-zinc-700">Raw Meeting JSON</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(jsonStr);
                        showToast("JSON copied to clipboard");
                      }}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="mt-3 max-h-[500px] overflow-auto rounded-xl bg-zinc-900 p-4 text-xs font-mono text-zinc-100 leading-relaxed">
                    {jsonStr}
                  </pre>
                </div>
              )}

              {/* SUMMARY CARD (4 Quadrants) */}
              {(activeTab === "summary" || activeTab === "insights") && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <div className="flex items-center gap-2 mb-5">
                    <IconDocumentText className="w-5 h-5 text-zinc-900" />
                    <h3 className="font-bold text-base text-zinc-900">Summary</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Quadrant 1: Key Discussion Points */}
                    <div className="rounded-xl border border-zinc-100 bg-[#f8fafc] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 mb-2.5">
                          <IconTarget className="w-4 h-4 text-zinc-700" />
                          <span>Key Discussion Points</span>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-600">
                          {(summary?.discussions || WIREFRAME_V2_RESULT.summary!.discussions).map((pt, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-zinc-400 mt-0.5">•</span>
                              <span className="leading-relaxed">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quadrant 2: Decisions Made */}
                    <div className="rounded-xl border border-zinc-100 bg-[#f8fafc] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 mb-2.5">
                          <IconCheckCircle className="w-4 h-4 text-zinc-700" />
                          <span>Decisions Made</span>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-600">
                          {(summary?.decisions || WIREFRAME_V2_RESULT.summary!.decisions).map((dec, i) => (
                            <li key={i} className="flex items-start justify-between gap-2 group">
                              <div className="flex items-start gap-2">
                                <span className="text-zinc-400 mt-0.5">•</span>
                                <span className="leading-relaxed">{dec.text}</span>
                              </div>
                              {dec.atMs !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => jumpToSegment(3)}
                                  className="text-[11px] font-medium text-blue-600 hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  View
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quadrant 3: Risks / Blockers */}
                    <div className="rounded-xl border border-zinc-100 bg-[#f8fafc] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 mb-2.5">
                          <IconAlertTriangle className="w-4 h-4 text-zinc-700" />
                          <span>Risks / Blockers</span>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-600">
                          {(summary?.risks || WIREFRAME_V2_RESULT.summary!.risks).map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-zinc-400 mt-0.5">•</span>
                              <span className="leading-relaxed">{r.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quadrant 4: Next Steps */}
                    <div className="rounded-xl border border-zinc-100 bg-[#f8fafc] p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 mb-2.5">
                          <IconChevronsRight className="w-4 h-4 text-zinc-700" />
                          <span>Next Steps</span>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-600">
                          {(summary?.nextSteps || WIREFRAME_V2_RESULT.summary!.nextSteps).map((ns, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-zinc-400 mt-0.5">•</span>
                              <span className="leading-relaxed">{ns}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION ITEMS TABLE CARD */}
              {(activeTab === "summary" || activeTab === "insights") && (
                <div id="action-items-section" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                  {/* Card Header & Tools */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <IconList className="w-5 h-5 text-zinc-900" />
                      <h3 className="font-bold text-base text-zinc-900">
                        Action Items ({summary?.actionItems.length ?? 3})
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddActionItemModal(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
                      >
                        <span>+ Add Item</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast("Action items synced to Jira!")}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
                      >
                        <IconJira className="w-3 h-3 text-blue-600" />
                        <span>Sync to Jira</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast("Action items synced to Notion!")}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
                      >
                        <IconNotion className="w-3 h-3 text-zinc-900" />
                        <span>Sync to Notion</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast("More options")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                      >
                        ⋮
                      </button>
                    </div>
                  </div>

                  {/* Action Items Data Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 pr-2 w-8">
                            <input type="checkbox" className="rounded border-zinc-300 text-zinc-900" />
                          </th>
                          <th className="py-2.5 pr-4">Assignee</th>
                          <th className="py-2.5 pr-4">Task</th>
                          <th className="py-2.5 pr-4">Deadline</th>
                          <th className="py-2.5 pr-4">Priority</th>
                          <th className="py-2.5 pr-3">Status</th>
                          <th className="py-2.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(summary?.actionItems || WIREFRAME_V2_RESULT.summary!.actionItems).map((item, idx) => {
                          const isDone = item.status === "done" || item.status === "Done";
                          const priority = item.priority || "Medium";

                          return (
                            <tr key={idx} className="hover:bg-zinc-50/60 transition-colors">
                              {/* Checkbox */}
                              <td className="py-3 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => handleToggleActionItem(idx)}
                                  className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* Assignee */}
                              <td className="py-3 pr-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-zinc-700 font-medium">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700">
                                    {item.assignee.slice(0, 2)}
                                  </div>
                                  <span>{displaySpeaker(item.assignee, summary?.speakerNames || [])}</span>
                                </div>
                              </td>

                              {/* Task */}
                              <td className="py-3 pr-4 max-w-xs break-words">
                                <span className={isDone ? "text-zinc-400 line-through" : "text-zinc-900 font-medium"}>
                                  {item.task}
                                </span>
                              </td>

                              {/* Deadline */}
                              <td className="py-3 pr-4 whitespace-nowrap text-zinc-600">
                                <div className="flex items-center gap-1">
                                  <IconCalendar className="w-3 h-3 text-zinc-400" />
                                  <span>{item.deadline}</span>
                                </div>
                              </td>

                              {/* Priority */}
                              <td className="py-3 pr-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                    priority === "High"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                      : priority === "Medium"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                  }`}
                                >
                                  {priority}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-3 pr-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleActionItem(idx)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                    isDone
                                      ? "bg-emerald-50 text-emerald-700"
                                      : item.status === "In Progress"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-zinc-100 text-zinc-700"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isDone ? "bg-emerald-500" : item.status === "In Progress" ? "bg-blue-500" : "bg-zinc-400"
                                    }`}
                                  />
                                  <span>{isDone ? "Done" : item.status || "To Do"}</span>
                                </button>
                              </td>

                              {/* Actions menu */}
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => showToast(`Options for "${item.task}"`)}
                                  className="text-zinc-400 hover:text-zinc-600 text-xs px-1"
                                >
                                  ···
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TRANSCRIPT CARD */}
              {(activeTab === "summary" || activeTab === "transcript") && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <IconMessageSquare className="w-5 h-5 text-zinc-900" />
                      <h3 className="font-bold text-base text-zinc-900">Transcript</h3>
                    </div>

                    {/* Filter and search bar matching wireframe */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search transcript */}
                      <div className="relative">
                        <input
                          type="search"
                          value={transcriptQuery}
                          onChange={(e) => setTranscriptQuery(e.target.value)}
                          placeholder="Search transcript..."
                          className="h-8 rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none w-48"
                        />
                        <span className="absolute left-2.5 top-2 text-zinc-400 text-xs">🔍</span>
                      </div>

                      {/* Speaker Filter dropdown */}
                      <select
                        value={speakerFilter}
                        onChange={(e) => setSpeakerFilter(e.target.value)}
                        className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 focus:outline-none"
                      >
                        <option value="all">All Speakers ⌵</option>
                        {distinctSpeakers.map((spk) => (
                          <option key={spk} value={spk}>
                            {displaySpeaker(spk, summary?.speakerNames || [])}
                          </option>
                        ))}
                      </select>

                      {/* Important Only Toggle */}
                      <button
                        type="button"
                        onClick={() => setImportantOnly(!importantOnly)}
                        className={`flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                          importantOnly
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <IconStar filled={importantOnly} className="w-3.5 h-3.5" />
                        <span>Important Only</span>
                      </button>

                      {/* Download button */}
                      <button
                        type="button"
                        onClick={() =>
                          downloadTextFile(
                            `${filenameBase}-transcript.txt`,
                            "text/plain",
                            transcript.map((t) => `[${formatClock(t.startMs)}] ${t.speaker}: ${t.text}`).join("\n\n"),
                          )
                        }
                        title="Download transcript"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  {/* Transcript Items List */}
                  <div className="space-y-3 mt-4 divide-y divide-zinc-50">
                    {filteredTranscript.length === 0 ? (
                      <p className="py-6 text-center text-xs text-zinc-500">No transcript lines match this filter.</p>
                    ) : (
                      filteredTranscript.map(({ seg, idx }) => {
                        const isStarred = starredIndices.has(idx);
                        return (
                          <div
                            key={idx}
                            id={`seg-${idx}`}
                            className={`pt-3 first:pt-0 flex items-start gap-3 p-2 rounded-xl transition-colors ${
                              isStarred ? "bg-amber-50/40" : "hover:bg-zinc-50/60"
                            }`}
                          >
                            {/* Timestamp */}
                            <span className="font-mono text-xs text-zinc-400 shrink-0 mt-0.5">
                              {formatClock(seg.startMs)}
                            </span>

                            {/* Speaker badge */}
                            <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                              {displaySpeaker(seg.speaker, summary?.speakerNames || [])}
                            </span>

                            {/* Content */}
                            <p className="flex-1 text-xs text-zinc-700 leading-relaxed break-words">{seg.text}</p>

                            {/* Audio Play button if audio is available */}
                            {audioAvailable && (
                              <button
                                type="button"
                                onClick={() => jumpToSegment(idx)}
                                className="text-[11px] text-blue-600 hover:underline shrink-0"
                              >
                                Play
                              </button>
                            )}

                            {/* Star Icon to toggle important */}
                            <button
                              type="button"
                              onClick={() => toggleStar(idx)}
                              className="shrink-0 text-zinc-300 hover:text-amber-500 p-0.5"
                              title={isStarred ? "Remove star" : "Mark as important"}
                            >
                              <IconStar filled={isStarred} className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN RAIL (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* QUICK ACTIONS CARD */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3.5">
                  <IconLightning className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">Quick Actions</h3>
                </div>

                <div className="space-y-1.5 text-xs font-medium text-zinc-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (summary) navigator.clipboard.writeText(toSummaryText(summary));
                      showToast("Summary copied to clipboard!");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconDocumentText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Copy Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showToast("Meeting link copied to clipboard!");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconUsers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconDocumentText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadTextFile(`${filenameBase}.json`, "application/json", jsonStr)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconCode className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRetrySummary}
                    disabled={retryingSummary}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-zinc-500">🔄</span>
                    <span>{retryingSummary ? "Regenerating…" : "Regenerate Summary"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => showToast("Translating to Japanese, Vietnamese & French coming soon!")}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-zinc-500">文A</span>
                      <span>Translate</span>
                    </div>
                    <span className="text-zinc-400 text-[10px]">›</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <span className="text-zinc-500">✉️</span>
                    <span>Create Follow-up Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (summary) navigator.clipboard.writeText(toActionItemsText(summary));
                      showToast("Tasks copied to clipboard!");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconCheckCircle className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Create Tasks</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAskAiModal(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200/70 bg-white px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <IconMessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Ask AI Follow-up</span>
                  </button>
                </div>
              </div>

              {/* AI INSIGHTS / THEMES CARD */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <IconSparkles className="w-4 h-4 text-zinc-900" />
                    <h3 className="font-bold text-sm text-zinc-900">AI Insights / Themes</h3>
                  </div>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700">AI</span>
                </div>

                {/* Themes tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {WIREFRAME_V2_METADATA.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                    >
                      {theme}
                    </span>
                  ))}
                </div>

                {/* Key Takeaways */}
                <div>
                  <p className="text-xs font-semibold text-zinc-900 mb-2">Key Takeaways</p>
                  <ul className="space-y-2 text-xs text-zinc-600">
                    {WIREFRAME_V2_METADATA.keyTakeaways.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold shrink-0">✓</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* SPEAKER BREAKDOWN DONUT CARD */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <IconUsers className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">Speaker Breakdown</h3>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                  <DonutChart breakdown={speakerBreakdownData} totalLabel="32 min" />

                  {/* Legend */}
                  <div className="space-y-2 text-xs">
                    {speakerBreakdownData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-zinc-700">{item.speaker}</span>
                        <span className="text-zinc-400">
                          {item.percentage}% ({item.duration})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TIMELINE / KEY MOMENTS CARD */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <IconClock className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">Timeline / Key Moments</h3>
                </div>

                {/* Horizontal Progress Timeline */}
                <div className="relative pt-2 pb-1">
                  {/* Connecting line */}
                  <div className="absolute top-4 left-2 right-2 h-0.5 bg-zinc-200" />

                  <div className="relative flex justify-between">
                    {WIREFRAME_V2_METADATA.timelineMoments.map((m, i) => (
                      <div key={i} className="flex flex-col items-center text-center max-w-[70px]">
                        {/* Dot */}
                        <div className="h-4 w-4 rounded-full border-2 border-white bg-zinc-800 shadow-xs z-10 mb-2" />
                        <span className="font-mono text-[10px] font-semibold text-zinc-900">{m.time}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight mt-0.5">{m.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DETECTED QUESTIONS / UNRESOLVED ITEMS */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3.5">
                  <IconHelpCircle className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">Detected Questions / Unresolved Items</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  {(summary?.unresolvedQuestions || WIREFRAME_V2_RESULT.summary!.unresolvedQuestions).map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-lg border border-zinc-100 bg-[#f8fafc] p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-400">•</span>
                        <span className="text-zinc-700 leading-relaxed">{q.text}</span>
                      </div>
                      <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        Open
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FOLLOW-UP RECOMMENDATIONS CARD */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <IconLightbulb className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">Follow-Up Recommendations</h3>
                </div>

                <ul className="space-y-2 text-xs text-zinc-600">
                  {WIREFRAME_V2_METADATA.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL: FOLLOW-UP EMAIL DRAFT */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">✉️</span>
                <h3 className="font-bold text-base text-zinc-900">Generated Follow-up Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase">Subject</label>
                <p className="mt-1 font-medium text-sm text-zinc-900">
                  {summary?.followUpEmail.subject || WIREFRAME_V2_RESULT.summary!.followUpEmail.subject}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase">Body</label>
                <div className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3.5 text-xs text-zinc-700 leading-relaxed border border-zinc-100">
                  {summary?.followUpEmail.body || WIREFRAME_V2_RESULT.summary!.followUpEmail.body}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const email = summary?.followUpEmail || WIREFRAME_V2_RESULT.summary!.followUpEmail;
                  navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`);
                  showToast("Email draft copied to clipboard!");
                  setShowEmailModal(false);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Copy Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASK AI FOLLOW-UP */}
      {showAskAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-5 h-5 text-zinc-900" />
                <h3 className="font-bold text-base text-zinc-900">Ask AI Follow-up</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAskAiModal(false);
                  setAiAnswer(null);
                  setAiQuestion("");
                }}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAskAi} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Question about the meeting</label>
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="e.g., Why did we choose the regular train?"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              {aiAnswer && (
                <div className="rounded-xl bg-zinc-50 p-3.5 text-xs text-zinc-800 border border-zinc-100">
                  <p className="font-semibold text-zinc-900 mb-1">AI Answer:</p>
                  <p className="leading-relaxed">{aiAnswer}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAskAiModal(false);
                    setAiAnswer(null);
                  }}
                  className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  Ask Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACTION ITEM */}
      {showAddActionItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-bold text-base text-zinc-900">+ Add Action Item</h3>
              <button
                type="button"
                onClick={() => setShowAddActionItemModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddActionItem} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-zinc-700">Task description</label>
                <input
                  type="text"
                  required
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g., Send presentation slides to client"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700">Assignee</label>
                  <input
                    type="text"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    placeholder="Speaker 3"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-700">Deadline</label>
                  <input
                    type="text"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    placeholder="Today"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-zinc-700">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as "High" | "Medium" | "Low")}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddActionItemModal(false)}
                  className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
