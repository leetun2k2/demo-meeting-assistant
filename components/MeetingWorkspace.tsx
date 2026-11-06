"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DURATION_WARNING_MS,
  GEMINI_API_KEY_STORAGE_KEY,
  KEYS_HELPER_TEXT,
  LAST_RESULT_STORAGE_KEY,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_MS,
  MAX_UPLOAD_BYTES,
  PROCESS_BUDGET_MS,
  SONIOX_API_KEY_STORAGE_KEY,
  SUMMARY_BUDGET_MS,
  SWITCH_INPUT_NOTICE,
  TOTAL_BUDGET_MS,
  UPLOAD_HELPER_TEXT,
} from "@/lib/constants";
import { formatBytes, formatClock } from "@/lib/format";
import { probeStorageAvailable, readStoredValue, removeStoredValue, writeStoredValue } from "@/lib/storage";
import { hasAllowedAudioFormat, isAudioSizeAllowed } from "@/lib/validateAudio";
import { isStoredMeetingResult } from "@/lib/meeting/storedResult";
import { normalizeStoredSpeakerNames } from "@/lib/meeting/cacheCompat";
import { setSessionAudio } from "@/lib/meeting/audioSession";
import { setSessionResult } from "@/lib/meeting/resultSession";
import type { MeetingErrorResponse, MeetingResult, SummaryRetryResult } from "@/lib/types";

type InputMode = "record" | "upload";
type RecordingState = "idle" | "acquiring" | "recording" | "finalizing" | "stopped";
type StopReason = "manual" | "limit" | "discard";
type ProcessStage = "uploading" | "summarizing";

interface AudioInput {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  // null when metadata could not be read within the bounded probe (PRD v3 FR-01: never block
  // the UI indefinitely on metadata reads, and never fabricate a duration).
  durationMs: number | null;
  source: InputMode;
}

// Reads duration from container metadata only (no full decode/waveform), bounded so a
// malformed or exotic file can never hang file selection (PRD v3 FR-01).
function probeAudioDuration(blob: Blob, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("audio");
    let settled = false;
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    function finish(value: number | null) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    }
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const ms = el.duration * 1000;
      finish(Number.isFinite(ms) && ms > 0 ? ms : null);
    };
    el.onerror = () => finish(null);
    el.src = url;
  });
}

const STORAGE_UNAVAILABLE_MESSAGE = "Your API key could not be saved in this browser.";

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

function extensionForMimeType(mimeType: string): string {
  return mimeType.includes("mp4") ? "m4a" : "webm";
}

export default function MeetingWorkspace() {
  const router = useRouter();

  // --- Configuration -------------------------------------------------------
  const [geminiKey, setGeminiKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [hasPreviousResult, setHasPreviousResult] = useState(false);

  // --- Audio input -----------------------------------------------------------
  const [inputMode, setInputMode] = useState<InputMode>("record");
  const [audio, setAudio] = useState<AudioInput | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const recordingTokenRef = useRef(0);
  const pendingStopReasonRef = useRef<StopReason>("manual");
  const mountedRef = useRef(true);

  // --- Processing ------------------------------------------------------------
  const [processStage, setProcessStage] = useState<ProcessStage | null>(null);
  const processing = processStage !== null;
  const [processError, setProcessError] = useState<string | null>(null);
  const attemptIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioInputTokenRef = useRef(0);

  // --- Lifecycle ---------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptIdRef.current += 1;
      abortControllerRef.current?.abort();
      stopMediaTracks();
      if (timerIdRef.current !== null) window.clearInterval(timerIdRef.current);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storageOk = probeStorageAvailable();
      const savedGemini = readStoredValue(GEMINI_API_KEY_STORAGE_KEY);
      if (savedGemini) setGeminiKey(savedGemini);
      if (!storageOk) setStorageNotice(STORAGE_UNAVAILABLE_MESSAGE);

      const savedResultRaw = readStoredValue(LAST_RESULT_STORAGE_KEY);
      if (savedResultRaw) {
        try {
          const parsed: unknown = JSON.parse(savedResultRaw);
          if (isStoredMeetingResult(normalizeStoredSpeakerNames(parsed))) setHasPreviousResult(true);
        } catch {
          // Corrupted entry; ignore
        }
      }

      removeStoredValue(SONIOX_API_KEY_STORAGE_KEY);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const previewUrl = useMemo(() => (audio ? URL.createObjectURL(audio.blob) : null), [audio]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processingStartRef = useRef<number | null>(null);
  const [, forceProcessingTick] = useState(0);
  useEffect(() => {
    if (!processing) {
      processingStartRef.current = null;
      return;
    }
    processingStartRef.current = Date.now();
    const id = window.setInterval(() => forceProcessingTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [processing]);

  const processingElapsedMs = processingStartRef.current ? Date.now() - processingStartRef.current : 0;

  // No fabricated percentage/ETA (PRD v3 FR-02): only the two real request stages and real
  // elapsed time are shown, driven by processStage, not a time-based guess.
  const durationOverLimit = !!audio?.durationMs && audio.durationMs > DURATION_WARNING_MS;

  const hasGeminiKey = geminiKey.trim() !== "";
  const isRecordingBusy = recordingState === "acquiring" || recordingState === "recording" || recordingState === "finalizing";
  const canProcess = !!audio && hasGeminiKey && !processing && !isRecordingBusy;
  const disabledReason = useMemo(() => {
    if (processing) return null;
    if (isRecordingBusy) return "Please stop recording before processing.";
    if (!audio && !hasGeminiKey) return "Enter your Gemini API key and provide audio to begin.";
    if (!hasGeminiKey) return "Enter your Gemini API key to process audio.";
    if (!audio) return "Record or upload audio to process.";
    return null;
  }, [processing, isRecordingBusy, audio, hasGeminiKey]);

  function handleGeminiKeyChange(value: string) {
    setGeminiKey(value);
    if (hydrated && !writeStoredValue(GEMINI_API_KEY_STORAGE_KEY, value.trim())) {
      setStorageNotice(STORAGE_UNAVAILABLE_MESSAGE);
    }
  }

  function handleClearKeys() {
    setGeminiKey("");
    const ok = removeStoredValue(GEMINI_API_KEY_STORAGE_KEY);
    setStorageNotice(ok ? null : "Your key could not be fully cleared from this browser's storage.");
  }

  function stopMediaTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (recordingState !== "idle" || processing) return;

    setAudio(null);
    setAudioError(null);
    setRecordingNotice(null);
    const token = ++recordingTokenRef.current;
    setRecordingState("acquiring");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (token === recordingTokenRef.current && mountedRef.current) {
        setRecordingState("idle");
        setAudioError(
          "Microphone access was denied or unavailable. Allow microphone access, or use Upload Audio instead.",
        );
      }
      return;
    }

    if (token !== recordingTokenRef.current || !mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      setRecordingState("idle");
      setAudioError("This browser cannot record audio. Use Upload Audio instead.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    bytesRef.current = 0;

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        bytesRef.current += event.data.size;
        if (bytesRef.current > MAX_RECORDING_BYTES && recorder.state === "recording") {
          stopRecordingInternal("discard");
        }
      }
    };
    recorder.onerror = () => {
      if (mountedRef.current) {
        setAudioError("Recording failed unexpectedly. Try again.");
        setRecordingState("idle");
      }
      stopMediaTracks();
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
    recorder.onstop = () => finalizeRecording(mimeType);

    recorder.start(250);
    startedAtRef.current = Date.now();
    setRecordingElapsedMs(0);
    setRecordingState("recording");
    timerIdRef.current = window.setInterval(() => {
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      setRecordingElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) {
        stopRecordingInternal("limit");
      }
    }, 250);
  }

  function stopRecordingInternal(reason: StopReason) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    pendingStopReasonRef.current = reason;
    setRecordingState("finalizing");
    recorder.stop();
  }

  function finalizeRecording(mimeType: string) {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    stopMediaTracks();

    const reason = pendingStopReasonRef.current;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    recorderRef.current = null;

    if (!mountedRef.current) return;

    if (reason === "discard" || blob.size > MAX_RECORDING_BYTES) {
      setRecordingState("idle");
      setRecordingElapsedMs(0);
      setAudioError("Recording exceeded the 20 MiB limit and was discarded. Try a shorter recording.");
      return;
    }

    if (blob.size === 0) {
      setRecordingState("idle");
      setRecordingElapsedMs(0);
      setAudioError("Recording captured no audio. Try again.");
      return;
    }

    setAudio({
      blob,
      filename: `recording.${extensionForMimeType(mimeType)}`,
      sizeBytes: blob.size,
      durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : null,
      source: "record",
    });
    setProcessError(null);
    setRecordingState("stopped");
    setRecordingNotice(reason === "limit" ? "5-minute limit reached. Your recording is ready to process." : null);
  }

  function handleRecordAgain() {
    if (isRecordingBusy || processing) return;
    setAudio(null);
    setAudioError(null);
    setRecordingNotice(null);
    setRecordingElapsedMs(0);
    setRecordingState("idle");
    setProcessError(null);
  }

  // --- Upload -----------------------------------------------------------------
  async function handleValidatedFile(file: File) {
    setAudioError(null);
    if (file.size === 0) {
      setAudioError("Selected file is empty. Choose another file.");
      return;
    }
    if (!isAudioSizeAllowed(file.size, MAX_UPLOAD_BYTES)) {
      setAudioError("File exceeds the 100 MiB limit. Choose a smaller file.");
      return;
    }
    if (!hasAllowedAudioFormat(file.name, file.type)) {
      setAudioError("Unsupported file type. Use MP3, WAV, M4A or WebM.");
      return;
    }

    const token = ++audioInputTokenRef.current;
    const durationMs = await probeAudioDuration(file);
    if (token !== audioInputTokenRef.current || !mountedRef.current) return;

    setAudio({ blob: file, filename: file.name, sizeBytes: file.size, durationMs, source: "upload" });
    setProcessError(null);
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void handleValidatedFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (processing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleValidatedFile(file);
  }

  // --- Tabs -----------------------------------------------------------------
  function switchInputMode(mode: InputMode) {
    if (mode === inputMode || processing || isRecordingBusy) return;
    setInputMode(mode);
    setAudioError(null);
    setRecordingNotice(null);
    if (audio) {
      setAudio(null);
      setProcessError(null);
    }
  }

  // --- Process meeting ---------------------------------------------------------
  // Checkpoints a result (memory handoff + best-effort cache) without navigating. Used both
  // for the "transcribed" checkpoint (summary not attempted yet) and for the final outcome,
  // right before navigate — see finalizeResult below (PRD v3 FR-05/Technical Design).
  function checkpointResult(result: MeetingResult) {
    setSessionResult(result);
    writeStoredValue(LAST_RESULT_STORAGE_KEY, JSON.stringify(result));
  }

  function finalizeResult(result: MeetingResult, attemptId: number) {
    if (attemptId !== attemptIdRef.current) return; // a newer attempt has since started
    checkpointResult(result);
    router.push("/results");
  }

  async function handleProcess() {
    if (!canProcess || !audio) return;

    const attemptId = ++attemptIdRef.current;
    setProcessStage("uploading");
    setProcessError(null);

    // One deadline for the whole attempt from the moment Process is pressed; each request
    // below is bounded by whichever is smaller: its own step budget or what's left of this
    // total (PRD v3 section 3/Technical Design budget rules).
    const overallDeadline = Date.now() + TOTAL_BUDGET_MS;

    const formData = new FormData();
    formData.append("audio", audio.blob, audio.filename);
    formData.append("geminiApiKey", geminiKey);

    try {
      const firstController = new AbortController();
      abortControllerRef.current = firstController;
      const firstBudget = Math.max(0, Math.min(PROCESS_BUDGET_MS, overallDeadline - Date.now()));
      const firstTimer = window.setTimeout(() => firstController.abort(), firstBudget);

      let res: Response;
      try {
        res = await fetch("/api/process-meeting", {
          method: "POST",
          body: formData,
          signal: firstController.signal,
        });
      } catch (err) {
        if (attemptId !== attemptIdRef.current) return;
        setProcessError(
          err instanceof DOMException && err.name === "AbortError"
            ? "Upload and transcription did not finish within the time budget. You can try again."
            : "Could not reach the server. Check your connection and try again.",
        );
        return;
      } finally {
        window.clearTimeout(firstTimer);
      }
      if (attemptId !== attemptIdRef.current) return;

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        if (attemptId !== attemptIdRef.current) return;
        setProcessError("The server returned an unexpected response.");
        return;
      }
      if (attemptId !== attemptIdRef.current) return;

      if (!res.ok) {
        setProcessError((data as MeetingErrorResponse)?.error || "Processing failed.");
        return;
      }

      const transcribed = data as MeetingResult;
      setSessionAudio(audio.blob);

      if (transcribed.status === "no_speech") {
        finalizeResult(transcribed, attemptId);
        return;
      }

      // Hold the transcript as a checkpoint before attempting summarization, so a summary
      // failure, timeout or this-tab cache failure can never lose it (PRD v3 FR-05).
      checkpointResult(transcribed);
      setProcessStage("summarizing");

      const remaining = overallDeadline - Date.now();
      if (remaining <= 0) {
        finalizeResult(
          { ...transcribed, status: "summary_failed", summaryError: "Ran out of time budget before summarization could start." },
          attemptId,
        );
        return;
      }

      const summaryController = new AbortController();
      abortControllerRef.current = summaryController;
      const summaryBudget = Math.min(SUMMARY_BUDGET_MS, remaining);
      const summaryTimer = window.setTimeout(() => summaryController.abort(), summaryBudget);

      let summaryRes: Response;
      try {
        summaryRes = await fetch("/api/summarize-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcribed.transcript, geminiApiKey: geminiKey }),
          signal: summaryController.signal,
        });
      } catch (err) {
        if (attemptId !== attemptIdRef.current) return;
        finalizeResult(
          {
            ...transcribed,
            status: "summary_failed",
            summaryError:
              err instanceof DOMException && err.name === "AbortError"
                ? "Summarization did not finish within the time budget."
                : "Could not reach the server to generate the summary.",
          },
          attemptId,
        );
        return;
      } finally {
        window.clearTimeout(summaryTimer);
      }
      if (attemptId !== attemptIdRef.current) return;

      let summaryData: unknown;
      try {
        summaryData = await summaryRes.json();
      } catch {
        if (attemptId !== attemptIdRef.current) return;
        finalizeResult(
          { ...transcribed, status: "summary_failed", summaryError: "The server returned an unexpected response while summarizing." },
          attemptId,
        );
        return;
      }
      if (attemptId !== attemptIdRef.current) return;

      if (!summaryRes.ok) {
        finalizeResult(
          { ...transcribed, status: "summary_failed", summaryError: (summaryData as MeetingErrorResponse)?.error || "Summarization failed." },
          attemptId,
        );
        return;
      }

      const summaryResult = summaryData as SummaryRetryResult;
      finalizeResult(
        { ...transcribed, status: summaryResult.status, summary: summaryResult.summary, summaryError: summaryResult.summaryError },
        attemptId,
      );
    } finally {
      if (attemptId === attemptIdRef.current) {
        setProcessStage(null);
        abortControllerRef.current = null;
      }
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-zinc-900 pb-16">
      {/* Aurora Ambient Background Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-tr from-indigo-400/20 via-purple-400/15 to-pink-300/15 blur-3xl animate-aurora" />
      <div className="pointer-events-none absolute top-[400px] -right-32 h-[350px] w-[350px] rounded-full bg-gradient-to-bl from-cyan-400/15 via-blue-400/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-[700px] -left-32 h-[350px] w-[350px] rounded-full bg-gradient-to-tr from-purple-400/15 via-indigo-400/10 to-transparent blur-3xl" />

      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 border-b border-indigo-100/70 bg-white/80 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-zinc-900">
                Nexus<span className="text-indigo-600 font-extrabold">AI</span> Meeting Intelligence
              </span>
              <span className="ml-2 hidden rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60 sm:inline-block">
                v2.5 PRO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/results"
              className="group flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50/60 hover:border-indigo-300 transition-all"
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 group-hover:scale-125 transition-transform" />
              <span>{hasPreviousResult ? "View Stored Results →" : "View Results →"}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pt-10 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-indigo-800 shadow-2xs backdrop-blur-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
            </span>
            Multimodal Meeting Analysis & Diarization
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            Transform Conversations into{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              Actionable Intelligence
            </span>
          </h1>

          <p className="mt-3 text-base text-zinc-600 sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Record voice or upload audio recordings. NexusAI generates instant diarized transcripts, executive takeaways, key decisions, and prioritized tasks.
          </p>
        </div>

        {/* BENTO GRID WORKSPACE */}
        <div className="space-y-6">
          {/* Bento Card 1: Configuration */}
          <section
            aria-labelledby="config-heading"
            className="group relative overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h2 id="config-heading" className="text-base font-bold text-zinc-900">
                    Gemini AI Configuration
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{KEYS_HELPER_TEXT}</p>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Client-Side Storage
              </span>
            </div>

            {storageNotice && (
              <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                {storageNotice}
              </div>
            )}

            <div className="mt-5 max-w-lg">
              <label htmlFor="gemini-key-input" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Google AI Studio Key (Gemini 2.5 / 3.5)
              </label>
              <div className="relative">
                <input
                  id="gemini-key-input"
                  name="geminiApiKey"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  disabled={processing}
                  onChange={(e) => handleGeminiKeyChange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 pr-20 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-zinc-100/70 transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  <span>Get free Gemini API Key</span>
                  <span className="text-[10px]">↗</span>
                </a>
                {geminiKey && (
                  <button
                    type="button"
                    onClick={handleClearKeys}
                    disabled={processing}
                    className="font-medium text-rose-600 hover:text-rose-800 transition-colors disabled:opacity-50"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Bento Card 2: Audio Input (Record vs Upload) */}
          <section
            aria-labelledby="audio-heading"
            className="group relative overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100/80">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </div>
                <div>
                  <h2 id="audio-heading" className="text-base font-bold text-zinc-900">
                    Audio Input Source
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">High-fidelity meeting recording or file ingest</p>
                </div>
              </div>

              {/* Segmented Mode Switcher */}
              <div
                className="flex items-center rounded-xl bg-zinc-100 p-1 border border-zinc-200/80 shadow-2xs"
                role="tablist"
                aria-label="Audio input method"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "record"}
                  disabled={processing || isRecordingBusy}
                  onClick={() => switchInputMode("record")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    inputMode === "record"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${recordingState === "recording" ? "bg-rose-500 animate-ping" : "bg-zinc-400"}`} />
                  <span>Record Live</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "upload"}
                  disabled={processing || isRecordingBusy}
                  onClick={() => switchInputMode("upload")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    inputMode === "upload"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4">{SWITCH_INPUT_NOTICE}</p>

            {/* TAB CONTENT: RECORD LIVE */}
            {inputMode === "record" ? (
              <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Digital Clock & Audio Wave Visualizer */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 shadow-2xs font-mono">
                      <span className="text-lg font-bold text-zinc-900">{formatClock(recordingElapsedMs)}</span>
                      <span className="text-xs text-zinc-400">/ {formatClock(MAX_RECORDING_MS)}</span>
                    </div>

                    {/* Equalizer animation bars */}
                    <div className="flex items-end gap-1 h-8 px-2">
                      <div className={`w-1.5 rounded-full bg-indigo-500 ${recordingState === "recording" ? "wave-bar-1" : "h-1.5"}`} />
                      <div className={`w-1.5 rounded-full bg-purple-500 ${recordingState === "recording" ? "wave-bar-2" : "h-2"}`} />
                      <div className={`w-1.5 rounded-full bg-pink-500 ${recordingState === "recording" ? "wave-bar-3" : "h-3"}`} />
                      <div className={`w-1.5 rounded-full bg-indigo-500 ${recordingState === "recording" ? "wave-bar-4" : "h-2"}`} />
                      <div className={`w-1.5 rounded-full bg-purple-500 ${recordingState === "recording" ? "wave-bar-5" : "h-1.5"}`} />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {recordingState === "idle" && (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={processing}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 hover:from-rose-500 hover:to-red-500 hover:shadow-rose-500/30 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                        <span>Start Recording</span>
                      </button>
                    )}

                    {recordingState === "recording" && (
                      <button
                        type="button"
                        onClick={() => stopRecordingInternal("manual")}
                        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition-all active:scale-95"
                      >
                        <span className="h-2 w-2 rounded-xs bg-rose-500" />
                        <span>Stop Recording</span>
                      </button>
                    )}

                    {audio && audio.source === "record" && recordingState === "stopped" && (
                      <button
                        type="button"
                        onClick={handleRecordAgain}
                        disabled={processing || isRecordingBusy}
                        className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        <span>Record Again</span>
                      </button>
                    )}
                  </div>
                </div>

                {recordingState === "acquiring" && (
                  <p className="mt-3 text-xs text-indigo-700 animate-pulse flex items-center gap-1.5">
                    <span>🎙️</span> Requesting microphone permissions from browser…
                  </p>
                )}
                {recordingState === "recording" && (
                  <p className="mt-3 text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    Recording live microphone stream. Speak clearly.
                  </p>
                )}
                {recordingNotice && (
                  <p className="mt-3 text-xs text-emerald-700 font-medium">{recordingNotice}</p>
                )}
              </div>
            ) : (
              /* TAB CONTENT: UPLOAD FILE */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`group/drop relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-50/60"
                    : "border-indigo-200/80 bg-zinc-50/40 hover:border-indigo-300 hover:bg-indigo-50/30"
                }`}
              >
                <input
                  type="file"
                  id="audio-file-input"
                  accept=".mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm"
                  onChange={handleFileSelect}
                  disabled={processing}
                  className="sr-only"
                />
                <label
                  htmlFor="audio-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center w-full"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-100 shadow-sm group-hover/drop:scale-105 transition-transform">
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                  </div>

                  <p className="mt-4 text-sm font-bold text-zinc-900">
                    Click to select audio or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{UPLOAD_HELPER_TEXT}</p>

                  <div className="mt-3 flex items-center gap-1.5">
                    {["MP3", "WAV", "M4A", "WebM", "Max 100 MiB"].map((badge) => (
                      <span
                        key={badge}
                        className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 shadow-2xs"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {/* Selected File / Recording Audio Card & Preview */}
            {audio && (
              <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 truncate max-w-xs sm:max-w-md">
                        {audio.filename}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        {formatBytes(audio.sizeBytes)} • {audio.durationMs !== null ? formatClock(audio.durationMs) : "duration unknown"} • {audio.source === "record" ? "Live Voice Capture" : "Uploaded Ingest"}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Ready for Ingest
                  </span>
                </div>

                {durationOverLimit && (
                  <p className="mt-3 text-[11px] font-semibold text-amber-700">
                    This file is about {formatClock(audio.durationMs!)} long, over the 60-minute demo target. Processing time and result quality beyond 60 minutes have not been verified.
                  </p>
                )}

                {previewUrl && (
                  <div className="mt-3">
                    <audio controls src={previewUrl} className="w-full h-9 rounded-lg" />
                  </div>
                )}
              </div>
            )}

            {audioError && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 font-medium">
                {audioError}
              </div>
            )}
          </section>

          {/* Bento Card 3: Processing & Action Launch */}
          <section
            aria-labelledby="process-heading"
            className="group relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 p-6 shadow-sm backdrop-blur-md transition-all hover:border-indigo-300 hover:shadow-md"
          >
            <h2 id="process-heading" className="sr-only">
              Processing & Action Launch
            </h2>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Process Meeting Intelligence</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Automated diarization, structured summary, and action items extraction
                </p>
              </div>

              {/* Primary Call to Action Button */}
              <button
                type="button"
                onClick={handleProcess}
                disabled={!canProcess}
                className={`relative group/btn flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 ${
                  processing
                    ? "bg-indigo-900 cursor-not-allowed opacity-90 shadow-none"
                    : canProcess
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.01]"
                    : "bg-zinc-400 cursor-not-allowed opacity-60 shadow-none"
                }`}
              >
                {processing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>{processStage === "uploading" ? "Uploading & Transcribing…" : "Generating Summary…"}</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 text-purple-200 group-hover/btn:rotate-12 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                    <span>Run AI Analysis</span>
                  </>
                )}
              </button>
            </div>

            {disabledReason && (
              <p className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5">
                <span className="text-indigo-500 font-bold">ℹ</span> {disabledReason}
              </p>
            )}

            {/* LIVE PROCESSING PROGRESS PANEL — two real stages and real elapsed time only;
                no fabricated percentage or ETA (PRD v3 FR-02). */}
            {processing && (
              <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-indigo-200/80 bg-white/95 p-5 shadow-md">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-ping" />
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      {processStage === "uploading" ? "Uploading & transcribing audio" : "Generating meeting summary"}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    Elapsed {formatClock(processingElapsedMs)}
                  </span>
                </div>

                {/* Indeterminate activity bar: there is no real percent-complete signal from
                    either request, so this communicates "still working," not progress. */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-100/70">
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-xs animate-indeterminate" />
                </div>

                <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed font-medium">
                  {processStage === "uploading"
                    ? "Large files can take several minutes. This step uploads the audio to Gemini and transcribes the full meeting."
                    : "Summarizing the full transcript. The transcript is already held in this tab even if this step fails."}
                </p>

                {/* Processing Steps Status Chips */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className={`rounded-xl p-2.5 text-xs border ${processStage === "uploading" ? "border-indigo-200 bg-indigo-50/70 text-indigo-900 font-semibold" : "border-emerald-200 bg-emerald-50/70 text-emerald-900 font-semibold"}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{processStage === "uploading" ? "1." : "✓"}</span>
                      <span>Upload & Transcribe</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-2.5 text-xs border ${processStage === "summarizing" ? "border-indigo-200 bg-indigo-50/70 text-indigo-900 font-semibold" : "border-zinc-200 bg-zinc-50 text-zinc-400"}`}>
                    <div className="flex items-center gap-1.5">
                      <span>2.</span>
                      <span>Summarize</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  <span>No fixed ETA — this attempt ends automatically at a {formatClock(TOTAL_BUDGET_MS)} total time budget.</span>
                </div>
              </div>
            )}

            {/* Process Error */}
            {processError && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-bold">⚠️</span>
                    <h4 className="text-xs font-bold text-rose-900">Analysis Encountered An Error</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProcessError(null)}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                  >
                    Dismiss ✕
                  </button>
                </div>
                <p className="mt-2 text-xs font-mono bg-rose-100/60 p-2.5 rounded-lg border border-rose-200 text-rose-800">
                  {processError}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
