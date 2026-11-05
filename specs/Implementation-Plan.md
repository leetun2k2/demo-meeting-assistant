# Implementation Plan — Task Breakdown and Task-Level Design

Date: 2026-11-05  
Status: Draft plan; no tasks implemented or verified.  
Sources: [PRD v2.3](PRD.md), [Technical Design](Technical-Design.md), [resolved findings](Requirement-Findings.md), [accepted UX refinements](UX-Proposals.md).

## Basis and constraints

The user confirmed the MVP choices, UX refinements and browser-local API-key saving. The Technical Design remains labeled draft; this plan translates its proposed single-request solution without implying separate architectural approval or implementation authorization. The two Gemini model choices are explicitly user-selected; deadline values remain proposed defaults, not verified account capabilities or latency guarantees.

Inspected repository facts: [app/page.tsx](../app/page.tsx) now renders the implemented workspace; `components/MeetingWorkspace.tsx`, `lib/meeting/soniox.ts`, `lib/meeting/gemini.ts`, and `app/api/process-meeting/route.ts` contain the previous provider flow; [package.json](../package.json) contains Next.js 16.4.5, React 19.3.0, Bun scripts and no provider SDKs; [tsconfig.json](../tsconfig.json) enables strict checking and the root `@/*` alias. [next.config.ts](../next.config.ts) enables cache components and existing Turbopack rules. Preserve those settings and the existing root layout/fonts. Follow the installed [Next.js route guide](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md) and relevant client-component guide before writing code.

Use native browser/Web APIs and existing dependencies. No database, filesystem audio/result storage, queue, background worker, streaming, model selector, Test Connection, wizard or production deployment. Browser keys are the only accepted persistent data. Server-only provider code must stay outside the client dependency graph. Runtime verification and real provider calls are explicitly excluded by PRD §8; completion criteria below describe intended implemented behavior, not executed test cases.

## Integration agreement

Settle these small shared interfaces at the start, without creating a separate architecture task:

- One `POST /api/process-meeting`, multipart fields `audio`, `geminiApiKey`; never send keys in URLs. Both input modes submit the same contract.
- One result object: `status`, `transcript`, `summary`, optional safe `summaryError` and optional `warnings`. A transcript segment has `speaker` (stable display label), `startMs` (finite nonnegative milliseconds) and `text`. Summary contains `discussions: string[]`, `decisions: string[]`, and `actionItems` with string `assignee`, `task`, `deadline`.
- Result status is `completed`, `summary_failed`, or `no_speech`. Only completed has a non-null summary. Summary failure retains transcript and a safe explanation; no speech has an empty transcript and null summary. These are HTTP 200 outcomes. Validation/transcription failures are non-2xx with a safe `error` and optional cleanup warnings, not a fabricated meeting result.
- Display and Raw JSON share that normalized object. Never return credentials, full provider responses or raw administration metadata. Cleanup warnings must not change a successful result into a failed transcription.
- Local constants enforce 20 × 1024 × 1024 audio bytes and five-minute recording. Local relative names/field choices here concretize the design without adding a standalone API-contract deliverable.

## Task 1 — Capture or select audio with reusable API configuration

**Outcome:** A usable one-page input workspace adapts the existing workspace, with one Gemini API key, Record/Upload tabs, one current audio and clear readiness feedback. Independent of provider implementation; use the shared contract without temporary production fake results.

**Approach and constraints:**

- Keep the server page/root shell and put interactive behavior in a client workspace. Preserve fonts, apply the light appearance, and keep labeled password inputs plus Clear saved keys visible.
- Keep localStorage entry `meeting-assistant.geminiApiKey`. Restore it after mount before enabling edits; user edits save it, empty input removes it, and Clear saved keys clears the one input/entry. Catch storage errors without blocking in-memory use or falsely claiming deletion. Remove the obsolete app-owned `meeting-assistant.sonioxApiKey` entry best-effort on mount, without reading/sending its value; preserve the existing Gemini entry and unrelated storage. Remove the Soniox UI/state/constants and hasBothKeys checks. Do not call localStorage.clear(), synchronize tabs, persist meetings, or write blank initial state over restored data.
- Idle input changes clear old audio/results as specified. Disable tab changes and Record Again during microphone acquisition, active recording and finalization as a local race-prevention choice. After recording is finalized, idle tab switching discards the current audio/results with the already-specified inline explanation and no modal.
- Use getUserMedia and MediaRecorder with supported WebM/Opus. Guard permission acquisition so repeated Start clicks cannot create multiple recorders. If permission resolves after unmount, stop the acquired tracks and ignore the stale result. Denial/unsupported capabilities show an actionable error and Upload alternative.
- Gather timed chunks in memory for byte accounting. At five minutes stop and finalize; at size overflow stop and discard the oversized recording. Final data may push the Blob over the cap: recheck the finalized Blob before marking it ready. Stop/auto-stop must be idempotent, and readiness waits for final data and stop events. Stop tracks and timers on all exit paths, including recorder errors/unmount.
- Use a native single-file upload input for MP3/WAV/M4A/WebM, reject empty/oversized/unsupported selections, and show filename/size and the PRD limit helper. Clear the input element as needed to permit reselecting the same file. Upload duration inspection is excluded.
- Timer shows elapsed against `05:00`, with the valid auto-stop message only for an accepted recording. Derive Process Meeting readiness and its nearby explanation from finalized audio, nonempty keys, recording activity and pending processing. The key need not be present to record/select audio.

**Completion:** The input workspace represents permission acquisition, recording, finalization, ready and invalid input distinctly; only one finalized audio can reach submission. Browser resources have explicit cleanup paths, saved keys cannot be wiped by initial hydration, and storage failure does not block processing. P0 does not depend on playback.

## Task 2 — Process one meeting through Gemini 3.5 Transcribe and Flash-Lite

**Outcome:** A server endpoint returns the normalized result or safe error for a complete pipeline. Independent of Task 1 beyond the integration agreement. Use the provider references linked in Technical Design for request details; documentation inspection is permitted, real authenticated calls are not.

**Approach and constraints:**

- Implement a POST Route Handler and a small server-only provider module if useful. Parse formData; validate required fields, audio size and allowed formats before any provider call. Align browser/server format screening: recognize the four formats from useful MIME metadata or extension when metadata is absent/generic; reject clearly unsupported MIME declarations. Provider decoding remains authoritative. No local file writes, transcoding or new validation dependency.
- Replace the Soniox adapter/orchestration in place with Gemini Files upload and a foreground Transcribe Interactions call, following Technical Design. Use fixed `gemini-3.5-transcribe` and `gemini-3.5-flash-lite`, with the same request-local Gemini key in x-goog-api-key headers. Remove Soniox imports, bearer auth, endpoints, job polling and job deletion. Preserve the existing app result types unless additive adjustment is necessary; do not recreate the app.
- Upload in-memory bytes using Gemini Files resumable start/finalize; retain file name/URI/MIME. Normalize supported MIME aliases and codec parameters. Wait for ACTIVE only if required, bounded by the STT deadline; reject FAILED. No inline base64 path is needed for the 20 MiB envelope.
- POST one nonstreaming foreground Interactions request with store:false and no previous interaction. Configure `generation_config.transcription_config.mode` as verbatim, speaker diarization and word timestamps per Technical Design. Do not combine with smart mode/custom vocabulary, restrict the meeting language, or substitute the live model. Use the documented REST API revision/header specified in Technical Design and verify its response envelope against the same revision.
- Parse completed model-output text and word_info annotations from steps; validate duration offsets and convert seconds to milliseconds. Stable-sort words, retain text/punctuation correctly, map speaker IDs consistently, and split at speaker changes or pauses of at least two seconds. Missing speaker is Unknown speaker. Missing timing for recognized speech is an integration error, not an invitation to fabricate offsets. Empty recognized text/words is no speech; blocked, truncated or noncompleted inference is an error.
- If no recognized speech, return no_speech and skip the summary model. Otherwise preserve normalized transcript before starting summarization. Request structured JSON with all summary fields required. Ground instructions in the supplied transcript and PRD rules for language, explicit commitments, named/self assignees, unknown ownership and verbatim relative deadlines. Treat transcript instructions as data; no tools, HTML generation, external lookup or separate language service.
- Runtime-validate parsed summary arrays and required action-item strings. Non-JSON, incorrect shape, empty/blocked candidates, truncated output, provider errors or summary timeout return summary_failed with transcript. Do not convert invalid output to completed empty lists. Semantic truthfulness remains unverified even when the shape is valid.
- Implement the design's proposed budgets: 180 seconds for Gemini Files upload/readiness and Transcribe inference, 60 seconds for summary and at most 10 total seconds of cleanup. Each operation uses its remaining phase budget. Transcription timeout fails the attempt; summary timeout preserves the transcript. These defaults do not guarantee every accepted upload completes.
- Track only the uploaded Gemini file resource owned by this attempt. After STT settles, attempt deletion before summary; on failure/abort, settle the active local request before cleanup. Use a separate cleanup signal with at most ten seconds total, without masking the primary result or restarting cleanup in finally. There are no Soniox transcription jobs to delete. Missing resource identity after a lost upload response, failed deletion or process shutdown can leave remote files; return a safe warning when possible. Do not delete unrelated account files or add a durable worker. Files API expiry and store:false are not zero-retention guarantees.
- Summarize only the normalized transcript using the existing Generate Content adapter retargeted to gemini-3.5-flash-lite. Preserve structured output, prompt grounding and runtime validation; the STT Interactions snake_case schema must not leak into this Generate Content request. Disconnect stops useful work; inference may continue remotely after cancellation, and a user retry can repeat paid work.

**Completion:** All three result statuses and non-2xx failures have explicit code paths; no-speech avoids the summary call; every summary failure preserves the available transcript. No provider secrets leak through output/log/error forwarding. Timeouts and cleanup are bounded, including upload/STT failures. Completion here is implementation completeness, not a claim that the providers were exercised.

## Task 3 — Connect processing and present trustworthy results

**Dependencies:** Tasks 1 and 2, with the shared result agreement allowing independent UI work before wiring the real endpoint.

**Outcome:** Record and Upload both drive the same single-request flow, with readable meeting output, the accepted UX copy and clear partial/error states.

**Approach and constraints:**

- At submit, use an immediate in-flight guard before awaiting anything. Snapshot current audio/keys, clear prior result/errors and start one same-origin request. Lock key editing/clearing, input modes, upload, recording and duplicate submission until settlement. Changing keys while idle never starts processing.
- Retain one client abort controller and monotonic attempt identifier. Ignore stale or unmounted completions; invalidate the identifier before aborting on unmount. Release the pending guard in a finally path only for the matching live attempt. Do not add cross-tab deduplication or retry loops.
- Parse non-2xx responses safely; unexpected/non-JSON server failures produce a generic readable message rather than crashing the page or echoing provider bodies. Failed submission preserves the selected audio and keys so Process Meeting can run the entire pipeline again.
- Pending UI shows Processing… and keep-page-open guidance. Do not manufacture provider stage feedback, percentages or estimated remaining time from elapsed time.
- Completed results present discussions, decisions and action items before the complete chronological transcript. Render explicit empty decision/action messages. Preserve Unknown and Not specified values rather than dropping fields or converting relative deadlines. Use stable speaker text/colors and formatted audio-relative timestamps; allow hours for longer uploaded files without imposing a duration probe.
- On summary_failed show the exact partial-success message, safe error and usable transcript. On no_speech show the no-speech message and recovery guidance. Render any cleanup warning alongside the primary outcome, without suppressing transcript/summary.
- Raw JSON uses native details, closed initially, with selectable plain-text serialization of the same result. All transcript/model content is React text; no arbitrary HTML. Use semantic headings, visible labels/focus, keyboard-operable tabs/buttons, a polite status region and actionable alerts. Timers are not live-announced every second. Wrap long filenames/tasks and contain JSON overflow so the single-page layout remains usable at narrow widths.

**Completion:** UI and JSON cannot mix outputs from different attempts; partial success cannot look like completed-empty summary; all locked controls recover after a handled failure. P0 includes every accepted low-effort copy/refinement without depending on P1 controls.

## Task 4 — Finish the local demo handoff

**Dependencies:** Tasks 1–3 for final claims; README drafting can begin earlier.

**Outcome:** Replace boilerplate README with the actual Bun startup instructions, key setup, desktop Chrome target and clear delivery limitations. Update root metadata to describe the assistant instead of Create Next App.

Document `bun install` and `bun dev`, the local address, one Gemini API key, browser key persistence/Clear saved keys, the two audio input methods, limits, provider data flow and full-pipeline retry behavior. Explain that localStorage masking is not encryption, audio/results disappear on refresh, cleanup is best-effort and processing requires keeping the local server/page running. Report delivered versus omitted P1 features and actual unresolved blockers. Do not include example credentials, claim guaranteed cleanup or successful runtime/provider verification, or expand into a test guide.

**Verification expectations:** PRD §8 excludes automated/manual tests, browser verification, real provider calls and test-case documents. Do not add tests or call providers for this task. Use static source review to check contract alignment, cleanup, storage initialization and error paths. Existing `bun run lint` and `bunx tsc --noEmit` are suitable static checks, not functional tests; record their actual results if run during implementation. A build is not required by this plan; if chosen as a compilation check, it must not invoke provider requests and its outcome must not be presented as runtime success. No checks were executed in preparing this plan.

**Completion:** The README matches implemented behavior, static-check outcomes and all unverified runtime/provider limitations are stated accurately, and no P0 omission is hidden by the timebox. Do not commit or publish without separate authorization.

## Optional P1 follow-up within remaining time

After P0, prioritize native audio preview, then Copy JSON. Preview depends on Task 1: use one local object URL and native audio controls, no autoplay, revoke URLs on replacement/unmount, and let a preview decoding error coexist with a processable file. Copy depends on Task 3: copy the exact visible JSON, show Copied only after fulfilled clipboard write, and provide readable failure plus manual selection. An elapsed processing timer is lower priority; do not announce ticks or present it as remaining time. These options need no backend changes, waveform, export library or custom player. Mark omitted P1 features explicitly in the handoff.

## Sequence, decisions and limits

Task 1 and Task 2 are independently implementable against the integration agreement. Task 3 integrates them; Task 4 closes the handoff. This decomposition does not request multi-agent execution. The one-hour development target is a prioritization constraint, not a validated estimate; finish P0 before P1 and report real blockers rather than silently removing required behavior.

No new product clarification is required. Provider account/model access, exact wire-format compatibility, latency and AI quality remain unverified integration risks from Technical Design. If documentation or later user verification contradicts the proposed endpoints/models or requires a different architecture, surface the evidence and revise the relevant design instead of introducing SDKs, persistence, streaming or multi-request orchestration silently. Independent input/UI work can proceed even if provider access is blocked.

This plan is saved for review and reflects the user-requested provider change. Code migration is handed off separately; this document does not claim successful API verification.
