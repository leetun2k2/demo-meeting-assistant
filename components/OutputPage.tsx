"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  ActionItem,
  MeetingErrorResponse,
  MeetingResult,
  SummaryRegenerateResult,
  SummaryRetryResult,
} from "@/lib/types";
import { displaySpeaker, normalizeSpeakerMentions } from "@/lib/meeting/display";
import { downloadTextFile, slugForFilename, toMarkdown, toSummaryText } from "@/lib/meeting/export";
import { formatClock } from "@/lib/format";
import {
  GEMINI_API_KEY_STORAGE_KEY,
  NOTES_CHAR_LIMIT,
  NOTES_HELPER_TEXT,
  NOTES_PLACEHOLDER,
  SUMMARY_BUDGET_MS,
  SUMMARY_TEXT_CHAR_LIMIT,
} from "@/lib/constants";
import { readStoredValue } from "@/lib/storage";
import { isWithinSummaryTextLimit } from "@/lib/meeting/textLimit";
import { isWithinNotesLimit } from "@/lib/meeting/notesLimit";

// Keeps a single page of segments rendered at a time for a long transcript, per PRD v3 FR-06.
// Search/filter still run over the full transcript before this slice is taken.
const TRANSCRIPT_PAGE_SIZE = 100;


// --- SVG Icons ---
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

function IconSend({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// --- Donut Chart with Vibrant Colors ---
function DonutChart({
  breakdown,
  totalLabel = "—",
  totalCaption = "Speaking time",
}: {
  breakdown: Array<{ speaker: string; percentage: number; color: string }>;
  totalLabel?: string;
  totalCaption?: string;
}) {
  const radius = 38;
  const strokeWidth = 12;
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
        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">{totalCaption}</span>
      </div>
    </div>
  );
}

interface OutputPageProps {
  result: MeetingResult;
  audioUrl: string | null;
  audioAvailable: boolean;
  onActionItemsChange: (next: ActionItem[]) => void;
  onSummaryUpdate: (next: SummaryRegenerateResult) => void;
  onMeetingChange: (changes: Partial<MeetingResult>) => void;
}

function renderHighlightedText(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 text-amber-950 px-0.5 rounded font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function OutputPage({
  result,
  audioUrl,
  audioAvailable,
  onActionItemsChange,
  onSummaryUpdate,
  onMeetingChange,
}: OutputPageProps) {
  const { transcript, summary } = result;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tracks the latest `result` prop and mount state so an in-flight Generate/Regenerate request
  // (PRD v4 FR-07) can tell, once it resolves, whether it should still be applied: ignored if
  // this component has unmounted, a newer request has since started, or the meeting currently
  // shown is no longer the one the request was sent for (the user navigated away and a different
  // result replaced this one). processedAt is stable across a regenerate, so it identifies "the
  // same meeting" without needing a dedicated id field.
  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "insights" | "full" | "json">("summary");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [actionFilter, setActionFilter] = useState<"all" | "pending" | "done">("all");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [importantOnly, setImportantOnly] = useState(false);
  const [starredIndices, setStarredIndices] = useState<Set<number>>(new Set());
  const [transcriptPage, setTranscriptPage] = useState(1);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  // Modals & Popups
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [showAddActionItemModal, setShowAddActionItemModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New action item state
  const [newTask, setNewTask] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newPriority, setNewPriority] = useState<"High" | "Medium" | "Low">("Medium");

  // Generate/Retry/Regenerate state (PRD v4 FR-07)
  const [retryingSummary, setRetryingSummary] = useState(false);
  const [generateSummaryError, setGenerateSummaryError] = useState<string | null>(null);
  const generateTokenRef = useRef(0);

  // Inline assignee editor state (PRD v4 FR-03/AC-06): tracks which action item row currently
  // has its free-text name field open, so selecting "Custom name…" doesn't require a modal.
  const [customAssigneeIdx, setCustomAssigneeIdx] = useState<number | null>(null);

  async function copyText(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); showToast(message); }
    catch { showToast("Could not copy. Please select and copy the text manually."); }
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3000);
  }

  const distinctSpeakers = useMemo(() => {
    return Array.from(new Set(transcript.map((s) => s.speaker)));
  }, [transcript]);

  const transcriptDuration = Math.max(0, ...transcript.map((t) => t.endMs ?? t.startMs));
  const durationMs = result.audioDurationMs ?? transcriptDuration;
  const durationLabel = durationMs > 0 ? `${formatClock(durationMs)}${result.audioDurationMs ? "" : " (est.)"}` : "Unavailable";
  const hasTiming = transcript.length > 0 && transcript.every((t) => t.endMs !== undefined && t.endMs > t.startMs);
  const speakerBreakdownData = useMemo(() => {
    const palette = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#10b981"];
    const counts: Record<string, number> = {};
    transcript.forEach((t) => { counts[t.speaker] = (counts[t.speaker] ?? 0) + (hasTiming ? t.endMs! - t.startMs : t.text.length); });
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return Object.entries(counts).map(([speaker, count], idx) => ({
      speaker: displaySpeaker(speaker, summary?.speakerNames ?? []),
      percentage: total ? Math.round(count / total * 100) : 0,
      duration: hasTiming ? `${(count / 60000).toFixed(1)} min` : "text share",
      color: palette[idx % palette.length],
    }));
  }, [transcript, hasTiming, summary]);

  const filteredActionItems = useMemo(() => {
    const items = (summary?.actionItems ?? []).map((item, idx) => ({ item, idx }));
    if (actionFilter === "pending") {
      return items.filter(({ item }) => item.status !== "done" && item.status !== "Done");
    }
    if (actionFilter === "done") {
      return items.filter(({ item }) => item.status === "done" || item.status === "Done");
    }
    return items;
  }, [summary?.actionItems, actionFilter]);

  // Filtered transcript — search/filter run over the full array (not a page of it), per
  // PRD v3 FR-06; pagination below only slices this already-filtered result for render.
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

  // Reset to page 1 whenever the query/filter changes so the page shown always matches what's
  // actually being filtered (PRD v3 Technical Design). Adjusted during render rather than in
  // an effect, per React's guidance for state that depends on a changed value.
  const transcriptFilterKey = `${transcriptQuery}\u0000${speakerFilter}\u0000${importantOnly}`;
  const [lastTranscriptFilterKey, setLastTranscriptFilterKey] = useState(transcriptFilterKey);
  if (transcriptFilterKey !== lastTranscriptFilterKey) {
    setLastTranscriptFilterKey(transcriptFilterKey);
    setTranscriptPage(1);
  }

  const transcriptPageCount = Math.max(1, Math.ceil(filteredTranscript.length / TRANSCRIPT_PAGE_SIZE));
  const clampedTranscriptPage = Math.min(transcriptPage, transcriptPageCount);
  const paginatedTranscript = useMemo(
    () => filteredTranscript.slice((clampedTranscriptPage - 1) * TRANSCRIPT_PAGE_SIZE, clampedTranscriptPage * TRANSCRIPT_PAGE_SIZE),
    [filteredTranscript, clampedTranscriptPage],
  );

  function toggleStar(idx: number) {
    setStarredIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // Jumps to a transcript segment by its original index, even when it's on another page or
  // currently hidden by a search/speaker/starred filter (PRD v3 FR-06: "jump mở đúng trang,
  // xóa filter nếu nó che đoạn đích").
  function jumpToSegment(idx: number) {
    const seg = transcript[idx];
    if (!seg) return;

    if (activeTab !== "transcript" && activeTab !== "full") {
      setActiveTab("transcript");
    }

    const q = transcriptQuery.trim().toLowerCase();
    const hiddenByFilter =
      (speakerFilter !== "all" && seg.speaker !== speakerFilter) ||
      (importantOnly && !starredIndices.has(idx)) ||
      (q !== "" && !seg.text.toLowerCase().includes(q));

    if (hiddenByFilter) {
      setSpeakerFilter("all");
      setImportantOnly(false);
      setTranscriptQuery("");
    }

    // When filters are being cleared, the segment's position in the (now unfiltered) list is
    // just its own index, since the unfiltered list preserves transcript order.
    const position = hiddenByFilter ? idx : filteredTranscript.findIndex((f) => f.idx === idx);
    const page = Math.max(1, Math.ceil((position + 1) / TRANSCRIPT_PAGE_SIZE));
    setTranscriptPage(page);

    if (audioAvailable && audioRef.current) {
      audioRef.current.currentTime = seg.startMs / 1000;
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => showToast("Audio playback unavailable."));
    }

    // Two animation frames give React time to apply the filter/page state change and render
    // the target segment before scrolling to it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`seg-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  function toggleAudioPlayback() {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => showToast("Audio playback unavailable."));
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
      assignee: newAssignee.trim() || "Unknown",
      deadline: newDeadline.trim() || "Not specified",
      priority: newPriority,
      status: "To Do",
    };
    onActionItemsChange([...summary.actionItems, newItem]);
    setNewTask("");
    setShowAddActionItemModal(false);
    showToast("Added new action item");
  }

  // True when `assignee` is exactly "Unknown" or a raw speaker key already present in this
  // transcript — i.e. it can be shown as a plain <select> option rather than free text.
  function isKnownAssigneeOption(assignee: string): boolean {
    return assignee === "Unknown" || distinctSpeakers.includes(assignee);
  }

  // Edits only the one action item at idx — never speakerNames or any other task (PRD v4
  // FR-03/AC-10). Selecting a raw speaker key links that task to that speaker; "Unknown" clears
  // ownership; "__custom__" just opens the free-text field below without changing the task yet.
  function handleAssigneeSelectChange(idx: number, value: string) {
    if (!summary) return;
    if (value === "__custom__") {
      setCustomAssigneeIdx(idx);
      return;
    }
    setCustomAssigneeIdx((cur) => (cur === idx ? null : cur));
    const next = summary.actionItems.map((item, i) => (i === idx ? { ...item, assignee: value } : item));
    onActionItemsChange(next);
  }

  function handleAssigneeCustomCommit(idx: number, value: string) {
    if (!summary) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = summary.actionItems.map((item, i) => (i === idx ? { ...item, assignee: trimmed } : item));
    onActionItemsChange(next);
    setCustomAssigneeIdx(null);
  }

  // Shared by Generate Summary (status "transcribed"), Retry Summary (status "summary_failed")
  // and Regenerate (status "completed") — PRD v4 FR-07: same request path, with notes/transcript
  // snapshotted at submit time so an edit made after clicking never changes what this request
  // sends. The caller (Results page, via onSummaryUpdate) decides how to apply a failure against
  // an already-completed summary; this function only ever reports what happened.
  async function handleGenerateSummary() {
    if (retryingSummary) return;
    if (!isWithinSummaryTextLimit(transcript)) {
      showToast(`This transcript is over the ${SUMMARY_TEXT_CHAR_LIMIT.toLocaleString()}-character limit supported for summarization in this demo.`);
      return;
    }
    const notesSnapshot = result.meetingNotes ?? "";
    if (!isWithinNotesLimit(notesSnapshot)) {
      showToast(`Notes are over the ${NOTES_CHAR_LIMIT.toLocaleString()}-character limit supported in this demo. Shorten them and try again.`);
      return;
    }
    const apiKey = readStoredValue(GEMINI_API_KEY_STORAGE_KEY);
    if (!apiKey) {
      showToast("Add your Gemini API key on the home page first.");
      return;
    }

    const token = ++generateTokenRef.current;
    const meetingIdentity = result.processedAt;
    const stillCurrent = () =>
      mountedRef.current && token === generateTokenRef.current && resultRef.current.processedAt === meetingIdentity;

    setGenerateSummaryError(null);
    setRetryingSummary(true);
    try {
      const res = await fetch("/api/summarize-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, geminiApiKey: apiKey, meetingNotes: notesSnapshot }),
        signal: AbortSignal.timeout(SUMMARY_BUDGET_MS),
      });
      const data = await res.json();
      if (!stillCurrent()) return;
      if (!res.ok) {
        const message = (data as MeetingErrorResponse)?.error || "Summary request failed.";
        setGenerateSummaryError(message);
        showToast(message);
        onSummaryUpdate({ status: "summary_failed", summary: null, summaryError: message, meetingNotes: notesSnapshot });
        return;
      }
      const summaryResult = data as SummaryRetryResult;
      onSummaryUpdate({ ...summaryResult, meetingNotes: notesSnapshot });
      showToast(summaryResult.status === "completed" ? "Summary generated." : summaryResult.summaryError || "Summary could not be generated. Please retry.");
      if (summaryResult.status !== "completed") setGenerateSummaryError(summaryResult.summaryError ?? "Summary could not be generated.");
    } catch (error) {
      if (!stillCurrent()) return;
      const message =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "Summarization did not finish within the time budget."
          : "Could not reach the server to generate the summary.";
      setGenerateSummaryError(message);
      showToast(message);
      onSummaryUpdate({ status: "summary_failed", summary: null, summaryError: message, meetingNotes: notesSnapshot });
    } finally {
      if (stillCurrent()) setRetryingSummary(false);
    }
  }

  const [askingAi, setAskingAi] = useState(false);
  async function handleAskAi(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuestion.trim() || askingAi) return;
    if (!isWithinSummaryTextLimit(transcript)) {
      showToast(`This transcript is over the ${SUMMARY_TEXT_CHAR_LIMIT.toLocaleString()}-character limit supported for Ask AI in this demo.`);
      return;
    }
    const apiKey = readStoredValue(GEMINI_API_KEY_STORAGE_KEY);
    if (!apiKey) { showToast("Add your Gemini API key on the home page first."); return; }
    setAskingAi(true);
    setAiAnswer(null);
    try {
      const res = await fetch("/api/ask-meeting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, question: aiQuestion, geminiApiKey: apiKey }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not answer the question.");
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("Gemini returned no answer.");
      setAiAnswer(normalizeSpeakerMentions(data.answer, summary?.speakerNames ?? []));
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not answer the question."); }
    finally { setAskingAi(false); }
  }

  function jumpToTime(atMs: number) {
    if (!transcript.length) return;
    const idx = transcript.reduce((best, t, i) => Math.abs(t.startMs - atMs) < Math.abs(transcript[best].startMs - atMs) ? i : best, 0);
    setActiveTab("summary");
    window.setTimeout(() => jumpToSegment(idx), 0);
  }

  // Only serialized when the Raw JSON tab is actually open, and on demand for Export JSON,
  // rather than on every render/result change — a long transcript makes this a real cost
  // (PRD v3 Technical Design: "chỉ serialize khi mở/download").
  const jsonStr = useMemo(() => (activeTab === "json" ? JSON.stringify(result, null, 2) : null), [activeTab, result]);
  const buildJsonForExport = () => JSON.stringify(result, null, 2);
  const filenameBase = summary ? slugForFilename(summary.title) : "meeting";
  const transcriptCharCount = useMemo(() => JSON.stringify(transcript).length, [transcript]);
  const overSummaryLimit = !isWithinSummaryTextLimit(transcript);

  // True once the live notes differ from the snapshot that produced the current summary (PRD v4
  // FR-07/AC-13) — only meaningful once there is a completed summary to compare against.
  const notesChangedSinceSummary = result.status === "completed" && (result.meetingNotes ?? "") !== (result.summaryNotes ?? "");

  // Data helpers
  const meetingTitle = summary?.title || "Meeting Results";
  const heroHeading =
    summary?.title ||
    (result.status === "no_speech"
      ? "No speech detected"
      : result.status === "transcribed"
      ? "Transcript ready — summary pending"
      : "Summary unavailable");
  const execSummary =
    summary?.executiveSummary ||
    result.summaryError ||
    (result.status === "transcribed"
      ? "The transcript is ready. Generate a summary to see the executive summary, decisions and action items."
      : "Upload or record another audio file to try again.");
  const decisionsCount = summary?.decisions.length ?? 0;
  const actionItemsCount = summary?.actionItems.length ?? 0;
  const completedItemsCount = (summary?.actionItems || []).filter((i) => i.status === "done" || i.status === "Done").length;
  const speakersCount = distinctSpeakers.length;

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-zinc-900 font-sans antialiased overflow-hidden pb-16">
      {/* Background Aurora Orbs */}
      <div className="pointer-events-none fixed -top-40 right-1/4 h-[500px] w-[700px] rounded-full bg-gradient-to-tr from-indigo-400/15 via-purple-400/10 to-pink-300/10 blur-3xl animate-aurora" />
      <div className="pointer-events-none fixed top-1/2 -left-40 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-cyan-400/10 via-indigo-300/10 to-transparent blur-3xl" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl animate-fade-in border border-zinc-700">
          <IconCheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden audio element for jump-to-audio playback */}
      {audioAvailable && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) => { const ms = e.currentTarget.duration * 1000; if (Number.isFinite(ms) && ms > 0 && ms !== result.audioDurationMs) onMeetingChange({ audioDurationMs: ms }); }}
          onTimeUpdate={(e) => setCurrentTimeSec(e.currentTarget.currentTime)}
          onEnded={() => setIsPlayingAudio(false)}
          className="hidden"
        />
      )}

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100/80 bg-white/85 px-6 py-3.5 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-indigo-600 transition-colors"
            title="Landing Page"
          >
            Home
          </Link>
          <span className="hidden sm:inline text-zinc-300">/</span>
          <Link
            href="/input"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all shadow-2xs"
            title="Back to meeting input workspace"
          >
            <span>←</span>
            <span className="hidden sm:inline">Input Workspace</span>
            <span className="sm:hidden">Input</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <IconSparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editedTitle.trim()) {
                        onMeetingChange({ summary: result.summary ? { ...result.summary, title: editedTitle.trim() } : null });
                      }
                      setIsEditingTitle(false);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        if (editedTitle.trim()) {
                          onMeetingChange({ summary: result.summary ? { ...result.summary, title: editedTitle.trim() } : null });
                        }
                        setIsEditingTitle(false);
                      }}
                      className="rounded-lg border border-indigo-400 bg-white px-2 py-0.5 text-base font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </form>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                      {meetingTitle}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedTitle(meetingTitle);
                        setIsEditingTitle(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-indigo-600 transition-opacity"
                      title="Edit meeting title"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-0.5">
                <span className="flex items-center gap-1 font-medium text-zinc-600">
                  <IconCalendar className="w-3.5 h-3.5 text-indigo-500" />
                  {result.processedAt ? `Processed on ${new Date(result.processedAt).toLocaleDateString()}` : "Date unavailable"}
                </span>
                <span className="text-zinc-300">•</span>
                <span className="flex items-center gap-1 font-medium text-zinc-600">
                  <IconClock className="w-3.5 h-3.5 text-cyan-500" />
                  {durationLabel}
                </span>
                <span className="text-zinc-300">•</span>
                <span className="flex items-center gap-1 font-medium text-zinc-600">
                  <IconUsers className="w-3.5 h-3.5 text-purple-500" />
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
            onClick={() => { const owner = window.prompt("Meeting owner", result.meetingOwner ?? ""); if (owner !== null) onMeetingChange({ meetingOwner: owner.trim() }); }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-2xs"
          >
            <span>{result.meetingOwner || "Assign Owner"}</span>
            <span className="text-[10px] text-zinc-400">⌵</span>
          </button>
          <button
            type="button"
            onClick={() => onMeetingChange({ reviewStatus: result.reviewStatus === "complete" ? "open" : "complete" })}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/70 transition-colors shadow-2xs"
          >
            <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>{result.reviewStatus === "complete" ? "Reopen Meeting" : "Mark Complete"}</span>
          </button>
          <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />
          <button
            type="button"
            disabled title="Tool integrations are not connected"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:shadow-md hover:shadow-indigo-500/20 transition-all shadow-xs active:scale-95"
          >
            <IconSend className="w-3.5 h-3.5" />
            <span>Sync to Tools</span>
            <span className="text-[10px] text-purple-200">⌵</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD GRID CONTENT */}
      <main className="p-6 sm:p-8 max-w-[1440px] w-full mx-auto">
        {result.warnings?.map((warning, i) => <p role="status" key={i} className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}

        {/* MEETING NOTES & CONTEXT (Collapsible for cleaner above-the-fold layout) */}
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-white/90 p-4 sm:p-5 shadow-xs transition-all hover:border-indigo-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-zinc-900">Meeting Context & Notes</h2>
                  {notesChangedSinceSummary && (
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Modified — Regenerate needed
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {notesExpanded ? NOTES_HELPER_TEXT : (result.meetingNotes ? (result.meetingNotes.slice(0, 80) + (result.meetingNotes.length > 80 ? "…" : "")) : "No extra context notes provided")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 font-mono">
                {(result.meetingNotes ?? "").length.toLocaleString()} / {NOTES_CHAR_LIMIT.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                <span>{notesExpanded ? "Collapse" : "Edit Notes"}</span>
                <span className="text-[10px] text-zinc-400">{notesExpanded ? "▲" : "▼"}</span>
              </button>
            </div>
          </div>

          {notesExpanded && (
            <div className="mt-4 pt-4 border-t border-indigo-50 animate-slide-up">
              <textarea
                value={result.meetingNotes ?? ""}
                disabled={retryingSummary}
                onChange={(e) => onMeetingChange({ meetingNotes: e.target.value })}
                placeholder={NOTES_PLACEHOLDER}
                maxLength={NOTES_CHAR_LIMIT}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-zinc-100/70 transition-all resize-y"
              />
              <div className="mt-2.5 flex items-center justify-between">
                <p className="text-[11px] text-zinc-400">
                  Notes are sent to Gemini when you click Regenerate to refine speaker names and context.
                </p>
                {result.status === "completed" && (
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={retryingSummary || transcript.length === 0 || overSummaryLimit}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span>{retryingSummary ? "Regenerating…" : "Regenerate Summary"}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT / CENTER COLUMN (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* TOP ROW: HERO SUMMARY CARD + 4 STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {/* Hero Meeting Summary Card (7 cols) */}
              <div className="md:col-span-7 relative overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 p-6 shadow-sm backdrop-blur-md flex flex-col justify-between hover:border-indigo-200 hover:shadow-md transition-all">
                {/* Aurora gradient light shape in corner */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent blur-2xl" />

                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 px-3 py-1 text-xs font-bold text-indigo-700">
                    <IconSparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Executive Summary</span>
                  </div>

                  <h2 className="mt-3.5 text-lg sm:text-xl font-bold tracking-tight text-zinc-900 leading-snug">
                    {heroHeading}
                  </h2>

                  <p className="mt-2.5 text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                    {execSummary}
                  </p>
                  {overSummaryLimit && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-700">
                      This transcript is {transcriptCharCount.toLocaleString()} characters, over the {SUMMARY_TEXT_CHAR_LIMIT.toLocaleString()}-character limit supported for summarization and Ask AI in this demo. The transcript itself remains viewable and exportable.
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-50 flex items-center justify-between text-xs text-indigo-700 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {summary ? "AI-generated analysis" : result.status === "transcribed" ? "Summary not yet generated" : "Analysis unavailable"}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={retryingSummary || transcript.length === 0 || overSummaryLimit}
                    className="hover:underline text-[11px] text-zinc-500 hover:text-indigo-600 disabled:no-underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retryingSummary
                      ? "Generating…"
                      : result.status === "transcribed"
                      ? "Generate Summary"
                      : result.status === "completed"
                      ? "Regenerate"
                      : "Retry Summary"}
                  </button>
                </div>
                {result.status === "completed" && !retryingSummary && (
                  <p className="mt-1.5 text-[10px] text-zinc-400 text-right">
                    Regenerating replaces the summary and action items, including any manual edits.
                  </p>
                )}
                {notesChangedSinceSummary && (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-700 text-right">
                    Notes changed since this summary — Regenerate to apply them.
                  </p>
                )}
                {generateSummaryError && result.status === "completed" && !retryingSummary && (
                  <p className="mt-1.5 text-[11px] font-semibold text-rose-700 text-right">
                    Last attempt failed: {generateSummaryError}
                  </p>
                )}
              </div>

              {/* 4 Stat Metric Tiles (5 cols, 2x2 grid) */}
              <div className="md:col-span-5 grid grid-cols-2 gap-3.5">
                {/* Stat 1: Key Decisions */}
                <div className="rounded-2xl border border-indigo-100/90 bg-white/90 p-4 shadow-2xs flex flex-col justify-between hover:border-indigo-200 hover:shadow-xs transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <IconCheckCircle className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-extrabold text-zinc-900">{decisionsCount}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-700">Key Decisions</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Identified in conversation</p>
                  </div>
                </div>

                {/* Stat 2: Action Items */}
                <div className="rounded-2xl border border-emerald-100/90 bg-white/90 p-4 shadow-2xs flex flex-col justify-between hover:border-emerald-200 hover:shadow-xs transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <IconList className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-extrabold text-zinc-900">{actionItemsCount}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-700">Action Items</p>
                    <p className="text-[10px] text-emerald-600 font-medium">{completedItemsCount} done</p>
                  </div>
                </div>

                {/* Stat 3: Speakers */}
                <div className="rounded-2xl border border-purple-100/90 bg-white/90 p-4 shadow-2xs flex flex-col justify-between hover:border-purple-200 hover:shadow-xs transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                      <IconUsers className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-extrabold text-zinc-900">{speakersCount}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-700">Participants</p>
                    <p className="text-[10px] text-purple-600 font-medium">Detected in transcript</p>
                  </div>
                </div>

                {/* Stat 4: Duration */}
                <div className="rounded-2xl border border-cyan-100/90 bg-white/90 p-4 shadow-2xs flex flex-col justify-between hover:border-cyan-200 hover:shadow-xs transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                      <IconClock className="w-5 h-5" />
                    </div>
                    <span className="text-xl font-extrabold text-zinc-900">{durationLabel}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-700">Audio Length</p>
                    <p className="text-[10px] text-cyan-600 font-medium">{result.audioDurationMs ? "Audio metadata" : "Transcript estimate"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AUDIO EQUALIZER / WAVEFORM PLAYER BAR */}
            <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!audioAvailable}
                  onClick={toggleAudioPlayback}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPlayingAudio ? (
                    <span className="font-bold text-xs">❚❚</span>
                  ) : (
                    <span className="font-bold text-xs ml-0.5">▶</span>
                  )}
                </button>
                <div>
                  <p className="text-xs font-bold text-zinc-900">Meeting Audio Playback</p>
                  <p className="text-[11px] font-mono text-zinc-500">
                    {formatClock(currentTimeSec * 1000)} / {durationLabel}
                  </p>
                </div>
              </div>

              <input
                type="range"
                aria-label="Audio playback seek bar"
                disabled={!audioAvailable}
                min="0"
                max={durationMs > 0 ? durationMs / 1000 : 1}
                step="0.1"
                value={currentTimeSec}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTimeSec(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="h-2 flex-1 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                {(summary?.keyMoments ?? []).map((moment, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => jumpToTime(moment.atMs)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50/80 border border-indigo-200/70 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100/80 transition-colors shadow-2xs"
                  >
                    <span>🕒 {formatClock(moment.atMs)}</span>
                    <span className="text-zinc-600 font-normal">· {moment.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-indigo-100/80 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === "summary"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <IconDocumentText className="w-3.5 h-3.5" />
                <span>Summary & Actions</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("transcript")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === "transcript"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <IconMessageSquare className="w-3.5 h-3.5" />
                <span>Diarized Transcript</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("insights")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === "insights"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <IconBarChart className="w-3.5 h-3.5" />
                <span>Deep Insights</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("full")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === "full"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <IconList className="w-3.5 h-3.5" />
                <span>Full Report</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === "json"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <IconCode className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>

            {/* JSON VIEW TAB */}
            {activeTab === "json" && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <span className="font-mono text-xs font-bold text-zinc-700">Raw Meeting JSON Output</span>
                  <button
                    type="button"
                    onClick={() => {
                      void copyText(jsonStr ?? "", "JSON copied to clipboard");
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="mt-3 max-h-[500px] overflow-auto rounded-xl bg-zinc-900 p-4 text-xs font-mono text-zinc-100 leading-relaxed">
                  {jsonStr ?? ""}
                </pre>
              </div>
            )}

            {/* SUMMARY CARD (4 Quadrants) */}
            {(activeTab === "summary" || activeTab === "insights" || activeTab === "full") && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <IconDocumentText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-base text-zinc-900">Meeting Takeaways</h3>
                  </div>
                  <span className="text-xs text-zinc-400">Structured 4-Quadrant View</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quadrant 1: Key Discussion Points */}
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50/30 p-4.5 flex flex-col justify-between hover:border-cyan-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-cyan-900 uppercase tracking-wider mb-3">
                        <span className="flex h-2 w-2 rounded-full bg-cyan-500" />
                        <span>Key Discussion Points</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-zinc-700">
                        {(summary?.discussions ?? []).map((pt, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-600 font-bold shrink-0 mt-0.5">•</span>
                            <span className="leading-relaxed font-medium">{pt}</span>
                          </li>
                        ))}
                        {!summary?.discussions.length && <li>No discussion points identified.</li>}
                      </ul>
                    </div>
                  </div>

                  {/* Quadrant 2: Decisions Made */}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4.5 flex flex-col justify-between hover:border-emerald-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider mb-3">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Decisions Made</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-zinc-700">
                        {(summary?.decisions ?? []).map((dec, i) => (
                          <li key={i} className="flex items-start justify-between gap-2 group">
                            <div className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                              <span className="leading-relaxed font-medium">{dec.text}</span>
                            </div>
                            {dec.atMs !== undefined && (
                              <button
                                type="button"
                                onClick={() => jumpToTime(dec.atMs!)}
                                className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                              >
                                {formatClock(dec.atMs)} ▶
                              </button>
                            )}
                          </li>
                        ))}
                        {!summary?.decisions.length && <li>No decisions identified.</li>}
                      </ul>
                    </div>
                  </div>

                  {/* Quadrant 3: Risks / Blockers */}
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4.5 flex flex-col justify-between hover:border-rose-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wider mb-3">
                        <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                        <span>Risks / Blockers</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-zinc-700">
                        {(summary?.risks ?? []).map((risk, i) => <li key={i}>{risk.text}</li>)}
                        {!summary?.risks.length && <li>No risks identified.</li>}
                      </ul>
                    </div>
                  </div>

                  {/* Quadrant 4: Next Steps */}
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4.5 flex flex-col justify-between hover:border-indigo-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-500" />
                        <span>Next Milestones</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-zinc-700">
                        {(summary?.nextSteps ?? []).map((step, i) => <li key={i}>{step}</li>)}
                        {!summary?.nextSteps.length && <li>No next steps identified.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTION ITEMS CARD & TABLE */}
            {(activeTab === "summary" || activeTab === "full") && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <IconList className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900">Action Items</h3>
                      <p className="text-xs text-zinc-500">Assignee and priority tracker</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl bg-zinc-100 p-1 border border-zinc-200/80">
                      <button
                        type="button"
                        onClick={() => setActionFilter("all")}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          actionFilter === "all" ? "bg-white text-indigo-700 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        All ({actionItemsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionFilter("pending")}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          actionFilter === "pending" ? "bg-white text-indigo-700 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        Pending ({actionItemsCount - completedItemsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionFilter("done")}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          actionFilter === "done" ? "bg-white text-emerald-700 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        Done ({completedItemsCount})
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!summary || retryingSummary} onClick={() => setShowAddActionItemModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100/70 transition-colors shadow-2xs"
                    >
                      <span>+ Add Task</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 pr-2 w-8">Done</th>
                        <th className="py-2.5 pr-4">Assignee</th>
                        <th className="py-2.5 pr-4">Task Description</th>
                        <th className="py-2.5 pr-4">Deadline</th>
                        <th className="py-2.5 pr-4">Priority</th>
                        <th className="py-2.5 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredActionItems.map(({ item, idx }) => {
                        const isDone = item.status === "done" || item.status === "Done";
                        const priority = item.priority || "Medium";

                        return (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3 pr-2">
                              <input
                                type="checkbox"
                                checked={isDone}
                                disabled={retryingSummary}
                                onChange={() => handleToggleActionItem(idx)}
                                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-zinc-800 font-semibold">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs ${
                                  idx % 3 === 0
                                    ? "bg-gradient-to-tr from-indigo-500 to-purple-600"
                                    : idx % 3 === 1
                                    ? "bg-gradient-to-tr from-cyan-500 to-blue-600"
                                    : "bg-gradient-to-tr from-amber-500 to-orange-600"
                                }`}>
                                  {displaySpeaker(item.assignee, summary?.speakerNames || []).slice(-2).toUpperCase()}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <select
                                    aria-label={`Assignee for task: ${item.task}`}
                                    value={customAssigneeIdx === idx ? "__custom__" : (isKnownAssigneeOption(item.assignee) ? item.assignee : "__custom__")}
                                    disabled={retryingSummary}
                                    onChange={(e) => handleAssigneeSelectChange(idx, e.target.value)}
                                    className="h-7 rounded-lg border border-zinc-200 bg-white px-1.5 text-[11px] font-semibold text-zinc-800 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                                  >
                                    <option value="Unknown">Unknown</option>
                                    {distinctSpeakers.map((s) => (
                                      <option key={s} value={s}>
                                        {displaySpeaker(s, summary?.speakerNames || [])}
                                      </option>
                                    ))}
                                    <option value="__custom__">Custom name…</option>
                                  </select>
                                  {(customAssigneeIdx === idx || !isKnownAssigneeOption(item.assignee)) && (
                                    <input
                                      type="text"
                                      aria-label={`Custom assignee name for task: ${item.task}`}
                                      defaultValue={isKnownAssigneeOption(item.assignee) ? "" : item.assignee}
                                      placeholder="Enter name"
                                      disabled={retryingSummary}
                                      onBlur={(e) => handleAssigneeCustomCommit(idx, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAssigneeCustomCommit(idx, e.currentTarget.value);
                                        }
                                      }}
                                      className="h-7 rounded-lg border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-800 focus:border-indigo-500 focus:outline-none"
                                    />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4 max-w-xs break-words">
                              <span className={isDone ? "text-zinc-400 line-through" : "text-zinc-900 font-medium"}>
                                {item.task}
                              </span>
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap text-zinc-600">
                              <div className="flex items-center gap-1.5 font-medium">
                                <IconCalendar className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{item.deadline}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  priority === "High"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                    : priority === "Medium"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                                    : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                }`}>
                                {priority}
                              </span>
                            </td>
                            <td className="py-3 pr-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleActionItem(idx)}
                                disabled={retryingSummary}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isDone
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                    : "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${isDone ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                <span>{isDone ? "Done" : "Pending"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredActionItems.length && (
                        <tr>
                          <td colSpan={6} className="py-5 text-center text-zinc-500 font-medium">
                            {actionFilter === "all" ? "No action items identified." : `No ${actionFilter} tasks found.`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(activeTab === "summary" || activeTab === "insights" || activeTab === "full") && (
              <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
                <h3 className="mb-3 font-bold">Open Questions</h3>
                <ul className="space-y-2 text-sm text-zinc-600">
                  {(summary?.unresolvedQuestions ?? []).map((question, i) => <li key={i}>{question.text}{question.atMs !== undefined && <button type="button" onClick={() => jumpToTime(question.atMs!)} className="ml-2 text-indigo-600">{formatClock(question.atMs)} ▶</button>}</li>)}
                  {!summary?.unresolvedQuestions.length && <li>No open questions identified.</li>}
                </ul>
              </section>
            )}

            {/* TRANSCRIPT CARD */}
            {(activeTab === "transcript" || activeTab === "full") && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                      <IconMessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900">Diarized Transcript</h3>
                      <p className="text-xs text-zinc-500">Synchronized speech-to-text with timestamp markers</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="transcript-search-input"
                      name="transcriptSearch"
                      type="search"
                      value={transcriptQuery}
                      onChange={(e) => setTranscriptQuery(e.target.value)}
                      placeholder="Search dialogue…"
                      className="h-8 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none w-44"
                    />

                    <select
                      id="speaker-filter-select"
                      name="speakerFilter"
                      value={speakerFilter}
                      onChange={(e) => setSpeakerFilter(e.target.value)}
                      className="h-8 rounded-xl border border-zinc-200 bg-zinc-50/50 px-2.5 text-xs text-zinc-700 font-medium focus:outline-none"
                    >
                      <option value="all">All Speakers</option>
                      {distinctSpeakers.map((spk) => (
                        <option key={spk} value={spk}>
                          {displaySpeaker(spk, summary?.speakerNames || [])}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setImportantOnly(!importantOnly)}
                      className={`h-8 rounded-xl px-2.5 text-xs font-semibold border transition-colors ${
                        importantOnly
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      ★ Starred
                    </button>
                  </div>
                </div>

                {filteredTranscript.length === 0 && (
                  <p className="mt-4 text-xs text-zinc-500">No segments match the current search/filter.</p>
                )}

                <div className="space-y-3 mt-4">
                  {paginatedTranscript.map(({ seg, idx }) => {
                    const isStarred = starredIndices.has(idx);
                    const isCurrentlyPlaying = isPlayingAudio && currentTimeSec * 1000 >= seg.startMs && (seg.endMs ? currentTimeSec * 1000 <= seg.endMs : currentTimeSec * 1000 < seg.startMs + 5000);
                    const speakerColor =
                      idx % 3 === 0
                        ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                        : idx % 3 === 1
                        ? "text-cyan-700 bg-cyan-50 border-cyan-200"
                        : "text-amber-700 bg-amber-50 border-amber-200";

                    return (
                      <div
                        key={idx}
                        id={`seg-${idx}`}
                        className={`rounded-xl border p-4 transition-all ${
                          isCurrentlyPlaying
                            ? "border-indigo-400 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-400/40"
                            : isStarred
                            ? "border-amber-200 bg-amber-50/30 shadow-2xs"
                            : "border-zinc-100 bg-[#f8fafc]/70 hover:bg-white hover:border-indigo-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${speakerColor}`}>
                              {displaySpeaker(seg.speaker, summary?.speakerNames || [])}
                            </span>
                            <span className="font-mono text-xs text-zinc-400">
                              {formatClock(seg.startMs)}
                            </span>
                            {isCurrentlyPlaying && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-white/90 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping" />
                                Playing
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => jumpToSegment(idx)}
                              className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-2xs"
                            >
                              {audioAvailable ? "▶ Play" : "View"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyText(seg.text, "Dialogue copied to clipboard")}
                              className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                              title="Copy dialogue"
                            >
                              <IconDocumentText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleStar(idx)}
                              className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                              title={isStarred ? "Remove star" : "Mark important"}
                            >
                              <IconStar filled={isStarred} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-zinc-700 font-normal">
                          {renderHighlightedText(seg.text, transcriptQuery)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {transcriptPageCount > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setTranscriptPage((p) => Math.max(1, p - 1))}
                      disabled={clampedTranscriptPage <= 1}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <span className="font-medium text-zinc-500">
                      Page {clampedTranscriptPage} of {transcriptPageCount} · {filteredTranscript.length} segment{filteredTranscript.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTranscriptPage((p) => Math.min(transcriptPageCount, p + 1))}
                      disabled={clampedTranscriptPage >= transcriptPageCount}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN RAIL (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* QUICK ACTIONS CARD */}
            <div className="rounded-2xl border border-indigo-100 bg-white/95 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                  <IconLightning className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900">Quick Actions</h3>
              </div>

              <div className="space-y-1.5 text-xs font-semibold text-zinc-700">
                <button
                  type="button"
                  disabled={!summary} onClick={() => {
                    if (summary) void copyText(toSummaryText(summary), "Summary copied to clipboard!");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-700 transition-all text-left"
                >
                  <IconDocumentText className="w-4 h-4 text-zinc-400" />
                  <span>Copy Formatted Summary</span>
                </button>

                <button
                  type="button"
                  disabled={!summary} onClick={() => setShowEmailModal(true)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 hover:bg-indigo-50/60 hover:border-indigo-200 hover:text-indigo-700 transition-all text-left"
                >
                  <span className="text-zinc-400">✉️</span>
                  <span>Draft Follow-up Email</span>
                </button>

                <button
                  type="button"
                  disabled={!transcript.length || overSummaryLimit}
                  title={overSummaryLimit ? `Transcript exceeds the ${SUMMARY_TEXT_CHAR_LIMIT.toLocaleString()}-character limit for Ask AI.` : undefined}
                  onClick={() => setShowAskAiModal(true)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5 hover:bg-indigo-100/70 text-indigo-800 transition-all text-left font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconSparkles className="w-4 h-4 text-indigo-600" />
                  <span>Ask AI Assistant</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadTextFile(`${filenameBase}.json`, "application/json", buildJsonForExport())}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 hover:bg-zinc-50 transition-colors text-left font-medium text-zinc-600"
                >
                  <IconCode className="w-4 h-4 text-zinc-400" />
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadTextFile(`${filenameBase}.md`, "text/markdown", toMarkdown(result))}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 hover:bg-zinc-50 transition-colors text-left font-medium text-zinc-600"
                >
                  <IconDocumentText className="w-4 h-4 text-zinc-400" />
                  <span>Export Markdown</span>
                </button>
              </div>
            </div>

            {/* SPEAKER BREAKDOWN DONUT CARD */}
            <div className="rounded-2xl border border-indigo-100 bg-white/95 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <IconUsers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900">Speaker Contribution {hasTiming ? "(estimated time)" : "(text share)"}</h3>
              </div>

              {!transcript.length && <p className="text-xs text-zinc-500">No speech data available.</p>}
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                <DonutChart breakdown={speakerBreakdownData} totalLabel={hasTiming ? formatClock(transcript.reduce((sum, t) => sum + t.endMs! - t.startMs, 0)) : `${distinctSpeakers.length} speakers`} totalCaption={hasTiming ? "Speaking time (est.)" : "Text share"} />

                <div className="space-y-2 text-xs w-full sm:w-auto">
                  {speakerBreakdownData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between sm:justify-start gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-zinc-700">{item.speaker}</span>
                      <span className="text-zinc-400 font-mono text-[11px]">
                        {item.percentage}% ({item.duration})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI THEMES / INSIGHTS CARD */}
            <div className="rounded-2xl border border-indigo-100 bg-white/95 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <IconSparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-zinc-900">Key Themes & Tags</h3>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                  {summary ? "AI-generated tags" : "Unavailable"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {!summary?.themes.length && <p className="text-xs text-zinc-500">No themes identified.</p>}
                {(summary?.themes ?? []).map((theme, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 px-2.5 py-1 text-[11px] font-bold text-indigo-800"
                  >
                    #{theme}
                  </span>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2">Core Insights</p>
                <ul className="space-y-2 text-xs text-zinc-600">
                  {!summary?.keyTakeaways.length && <li>No insights identified.</li>}
                  {(summary?.keyTakeaways ?? []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span className="leading-relaxed font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: ADD ACTION ITEM */}
      {showAddActionItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-indigo-100 animate-scale-in">
            <h3 className="text-base font-bold text-zinc-900">Add New Action Item</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Create a task linked to this meeting</p>

            <form onSubmit={handleAddActionItem} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label htmlFor="new-task-input" className="block font-semibold text-zinc-700 mb-1">Task Title</label>
                <input
                  id="new-task-input"
                  name="newTask"
                  type="text"
                  required
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Describe the task"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-assignee-select" className="block font-semibold text-zinc-700 mb-1">Assignee</label>
                  <select
                    id="new-assignee-select"
                    name="newAssignee"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-2.5 py-2 text-xs focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {distinctSpeakers.map((s) => (
                      <option key={s} value={s}>
                        {displaySpeaker(s, summary?.speakerNames || [])}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-priority-select" className="block font-semibold text-zinc-700 mb-1">Priority</label>
                  <select
                    id="new-priority-select"
                    name="newPriority"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "High" | "Medium" | "Low")}
                    className="w-full rounded-xl border border-zinc-200 px-2.5 py-2 text-xs focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="new-deadline-input" className="block font-semibold text-zinc-700 mb-1">Deadline</label>
                <input
                  id="new-deadline-input"
                  name="newDeadline"
                  type="text"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  placeholder="Deadline, if known"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddActionItemModal(false)}
                  className="rounded-xl border border-zinc-200 px-3.5 py-2 font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  Save Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASK AI */}
      {showAskAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-indigo-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-zinc-900">Ask Meeting AI Assistant</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAskAiModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAskAi} className="mt-4">
              <p className="text-xs text-zinc-500 mb-2">
                Ask questions about decisions, speaker consensus, or budget constraints discussed in this meeting.
              </p>
              <div className="relative">
                <label htmlFor="ai-question-input" className="sr-only">Question for AI</label>
                <input
                  id="ai-question-input"
                  name="aiQuestion"
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="What should we focus on next?"
                  className="w-full rounded-xl border border-indigo-200 px-3.5 py-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={askingAi}
                  className="absolute right-1.5 top-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  {askingAi ? "Thinking…" : "Ask"}
                </button>
              </div>
            </form>

            {aiAnswer && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs">
                <p className="font-bold text-indigo-900 mb-1">AI Answer:</p>
                <p className="text-zinc-700 leading-relaxed font-medium">{aiAnswer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: FOLLOW-UP EMAIL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-indigo-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-900">Draft Follow-Up Email</h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Subject</label>
                <input
                  type="text"
                  readOnly
                  value={summary?.followUpEmail.subject ?? ""}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Body</label>
                <textarea
                  rows={8}
                  readOnly
                  value={summary?.followUpEmail.body ?? ""}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="rounded-xl border border-zinc-200 px-3.5 py-2 font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!summary) return;
                    void copyText(`${summary.followUpEmail.subject}\n\n${summary.followUpEmail.body}`, "Email draft copied!");
                    setShowEmailModal(false);
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
