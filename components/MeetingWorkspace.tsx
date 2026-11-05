"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import ResultsPanel from "@/components/ResultsPanel";
import {
  GEMINI_API_KEY_STORAGE_KEY,
  KEYS_HELPER_TEXT,
  LAST_RESULT_STORAGE_KEY,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_MS,
  SONIOX_API_KEY_STORAGE_KEY,
  SWITCH_INPUT_NOTICE,
  UPLOAD_HELPER_TEXT,
} from "@/lib/constants";
import { formatBytes, formatClock } from "@/lib/format";
import { probeStorageAvailable, readStoredValue, removeStoredValue, writeStoredValue } from "@/lib/storage";
import { hasAllowedAudioFormat, isAudioSizeAllowed } from "@/lib/validateAudio";
import type { MeetingErrorResponse, MeetingResult } from "@/lib/types";

type InputMode = "record" | "upload";
type RecordingState = "idle" | "acquiring" | "recording" | "finalizing" | "stopped";
type StopReason = "manual" | "limit" | "discard";

interface AudioInput {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  source: InputMode;
}

const STORAGE_UNAVAILABLE_MESSAGE = "Your API key could not be saved in this browser.";

// Loose runtime guard for a result restored from localStorage: the stored JSON could be from
// an older app version or hand-edited, so shape it like any other untrusted external input.
function isStoredMeetingResult(value: unknown): value is MeetingResult {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    (obj.status === "completed" || obj.status === "summary_failed" || obj.status === "no_speech") &&
    Array.isArray(obj.transcript)
  );
}

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
  // --- Configuration -------------------------------------------------------
  const [geminiKey, setGeminiKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // --- Audio input -----------------------------------------------------------
  const [inputMode, setInputMode] = useState<InputMode>("record");
  const [audio, setAudio] = useState<AudioInput | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

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
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const attemptIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Restore saved keys once on mount (before this, the workspace renders without browser
  // API access so server rendering and first paint cannot read storage or mismatch it).
  // A one-time external-storage sync has no non-effect equivalent here, unlike the
  // write-on-edit effects below which were moved into their event handlers instead.
  useEffect(() => {
    const storageOk = probeStorageAvailable();
    const savedGemini = readStoredValue(GEMINI_API_KEY_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount sync from localStorage
    if (savedGemini) setGeminiKey(savedGemini);
    if (!storageOk) setStorageNotice(STORAGE_UNAVAILABLE_MESSAGE);

    const savedResultRaw = readStoredValue(LAST_RESULT_STORAGE_KEY);
    if (savedResultRaw) {
      try {
        const parsed: unknown = JSON.parse(savedResultRaw);
        if (isStoredMeetingResult(parsed)) setResult(parsed);
      } catch {
        // Corrupted/outdated entry; ignore rather than surface a restore error.
      }
    }

    // Best-effort migration cleanup: drop the obsolete Soniox entry from the previous
    // two-provider flow without reading or sending its value.
    removeStoredValue(SONIOX_API_KEY_STORAGE_KEY);
    setHydrated(true);
  }, []);

  // Keep the last result mirrored to localStorage so a reload doesn't lose it; audio itself
  // is still never persisted. Writes/removes after hydration only, so an empty initial state
  // cannot wipe a value this same effect just restored above.
  useEffect(() => {
    if (!hydrated) return;
    if (result) {
      writeStoredValue(LAST_RESULT_STORAGE_KEY, JSON.stringify(result));
    } else {
      removeStoredValue(LAST_RESULT_STORAGE_KEY);
    }
  }, [result, hydrated]);

  // Native audio preview (P1): derive the object URL from the current audio during render,
  // and only use an effect for the cleanup side effect (revoking it on change/unmount).
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
  // Recomputed each render; forceProcessingTick above forces a render every second.
  const processingElapsedMs = processingStartRef.current ? Date.now() - processingStartRef.current : 0;

  // --- Derived state -----------------------------------------------------------
  const hasGeminiKey = geminiKey.trim() !== "";
  const isRecordingBusy = recordingState === "acquiring" || recordingState === "recording" || recordingState === "finalizing";
  const canProcess = !!audio && hasGeminiKey && !processing && !isRecordingBusy;
  const disabledReason = useMemo(() => {
    if (processing) return null;
    if (isRecordingBusy) return "Stop recording before processing.";
    if (!audio || !hasGeminiKey) return "Add your Gemini API key and record or upload audio.";
    return null;
  }, [processing, isRecordingBusy, audio, hasGeminiKey]);

  function clearResults() {
    setResult(null);
    setProcessError(null);
  }

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

  // --- Recording ------------------------------------------------------------
  function stopMediaTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (recordingState !== "idle" || processing) return;
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
        if (bytesRef.current > MAX_AUDIO_BYTES && recorder.state === "recording") {
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

    if (reason === "discard" || blob.size > MAX_AUDIO_BYTES) {
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
      source: "record",
    });
    clearResults();
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
    clearResults();
  }

  // --- Upload -----------------------------------------------------------------
  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAudioError(null);
    if (file.size === 0) {
      setAudioError("Selected file is empty. Choose another file.");
      return;
    }
    if (!isAudioSizeAllowed(file.size)) {
      setAudioError("File exceeds the 20 MiB limit. Choose a smaller file.");
      return;
    }
    if (!hasAllowedAudioFormat(file.name, file.type)) {
      setAudioError("Unsupported file type. Use MP3, WAV, M4A or WebM.");
      return;
    }

    setAudio({ blob: file, filename: file.name, sizeBytes: file.size, source: "upload" });
    clearResults();
  }

  // --- Tabs -----------------------------------------------------------------
  function switchInputMode(mode: InputMode) {
    if (mode === inputMode || processing || isRecordingBusy) return;
    setInputMode(mode);
    setAudioError(null);
    setRecordingNotice(null);
    if (audio) {
      setAudio(null);
      clearResults();
    }
  }

  // --- Process meeting ---------------------------------------------------------
  async function handleProcess() {
    if (!canProcess || !audio) return;

    const attemptId = ++attemptIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setProcessing(true);
    clearResults();

    const formData = new FormData();
    formData.append("audio", audio.blob, audio.filename);
    formData.append("geminiApiKey", geminiKey);

    try {
      const res = await fetch("/api/process-meeting", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (attemptId !== attemptIdRef.current) return;

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setProcessError("The server returned an unexpected response.");
        return;
      }
      if (attemptId !== attemptIdRef.current) return;

      if (!res.ok) {
        setProcessError((data as MeetingErrorResponse)?.error || "Processing failed.");
        return;
      }
      setResult(data as MeetingResult);
    } catch (err) {
      if (attemptId !== attemptIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setProcessError("Could not reach the server. Check your connection and try again.");
    } finally {
      if (attemptId === attemptIdRef.current) {
        setProcessing(false);
        abortControllerRef.current = null;
      }
    }
  }

  const tabButtonClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
    }`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Meeting Assistant</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Record or upload a meeting. Get a transcript, decisions and action items.
        </p>
      </header>

      {/* Section 1 — Configuration */}
      <section aria-labelledby="config-heading" className="rounded-lg border border-zinc-200 p-5">
        <h2 id="config-heading" className="text-base font-semibold text-zinc-900">
          Configuration
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{KEYS_HELPER_TEXT}</p>
        {storageNotice && (
          <p role="status" className="mt-2 text-sm text-amber-700">
            {storageNotice}
          </p>
        )}

        <div className="mt-4 max-w-sm">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Gemini API Key</span>
            <input
              type="password"
              autoComplete="off"
              value={geminiKey}
              disabled={processing}
              onChange={(e) => handleGeminiKeyChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleClearKeys}
          disabled={processing || !geminiKey}
          className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear saved keys
        </button>
      </section>

      {/* Section 2 — Audio Input */}
      <section aria-labelledby="audio-heading" className="mt-6 rounded-lg border border-zinc-200 p-5">
        <h2 id="audio-heading" className="text-base font-semibold text-zinc-900">
          Audio Input
        </h2>

        <div className="mt-3 flex items-center gap-2" role="tablist" aria-label="Audio input method">
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === "record"}
            className={tabButtonClass(inputMode === "record")}
            disabled={processing || isRecordingBusy}
            onClick={() => switchInputMode("record")}
          >
            Record Audio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === "upload"}
            className={tabButtonClass(inputMode === "upload")}
            disabled={processing || isRecordingBusy}
            onClick={() => switchInputMode("upload")}
          >
            Upload Audio
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">{SWITCH_INPUT_NOTICE}</p>

        {inputMode === "record" ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startRecording}
                disabled={processing || recordingState !== "idle"}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Recording
              </button>
              <button
                type="button"
                onClick={() => stopRecordingInternal("manual")}
                disabled={recordingState !== "recording"}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop Recording
              </button>
              <button
                type="button"
                onClick={handleRecordAgain}
                disabled={processing || isRecordingBusy || !audio || audio.source !== "record"}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Record Again
              </button>
              <span className="font-mono text-sm text-zinc-500">
                {formatClock(recordingElapsedMs)} / {formatClock(MAX_RECORDING_MS)}
              </span>
            </div>
            {recordingState === "acquiring" && <p className="text-sm text-zinc-500">Requesting microphone access…</p>}
            {recordingState === "recording" && <p className="text-sm text-zinc-500">Recording…</p>}
            {recordingNotice && <p className="text-sm text-emerald-700">{recordingNotice}</p>}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm"
              onChange={handleFileSelect}
              disabled={processing}
              className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-zinc-400">{UPLOAD_HELPER_TEXT}</p>
          </div>
        )}

        {audio && (
          <p className="mt-3 text-sm text-zinc-600">
            Selected: <span className="font-medium">{audio.filename}</span> ({formatBytes(audio.sizeBytes)})
          </p>
        )}
        {previewUrl && (
          // P1: native playback only, no autoplay, no waveform/custom player.
          <audio controls src={previewUrl} className="mt-2 w-full" />
        )}
        {audioError && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {audioError}
          </p>
        )}
      </section>

      {/* Section 3 — Processing */}
      <section aria-labelledby="process-heading" className="mt-6 rounded-lg border border-zinc-200 p-5">
        <h2 id="process-heading" className="sr-only">
          Processing
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleProcess}
            disabled={!canProcess}
            className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? "Processing…" : "Process Meeting"}
          </button>
          {disabledReason && <p className="text-sm text-zinc-500">{disabledReason}</p>}
        </div>

        <div role="status" aria-live="polite" className="mt-3 text-sm text-zinc-600">
          {processing && (
            <>
              Keep this page open; processing may take a few minutes.{" "}
              <span aria-hidden="true" className="font-mono text-zinc-400">
                Elapsed {formatClock(processingElapsedMs)}
              </span>
            </>
          )}
        </div>

        {processError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {processError}
          </p>
        )}
      </section>

      {/* Section 4 — Results */}
      {result && <ResultsPanel result={result} />}
    </div>
  );
}
