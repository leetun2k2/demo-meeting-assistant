# Prompt — migrate the existing demo to Gemini STT and summary

Copy the prompt below into Claude in this repository. This is an implementation handoff, not a report that code has already been migrated.

```text
Update the existing code in /Users/tungle/Desktop/workspace/tmp/demo-meeting-assistant to match specs/PRD.md v2.3, specs/Technical-Design.md and specs/Implementation-Plan.md. Read AGENTS.md and relevant installed Next.js guides first. Preserve unrelated uncommitted work. Inspect the actual current code; do not recreate the application.

Required change:
- STT: fixed gemini-3.5-transcribe, with speaker diarization and word-level timestamps.
- Summary: fixed gemini-3.5-flash-lite.
- One Gemini API key shared by both stages, saved/restored at meeting-assistant.geminiApiKey in localStorage. Keep Clear saved keys and graceful storage-failure behavior. Remove Soniox configuration/state/request fields and best-effort remove only the obsolete meeting-assistant.sonioxApiKey entry. Never print credentials or clear unrelated storage.

Current integration points to inspect: components/MeetingWorkspace.tsx, components/ResultsPanel.tsx, app/api/process-meeting/route.ts, lib/meeting/soniox.ts, lib/meeting/gemini.ts, lib/constants.ts, lib/storage.ts, lib/types.ts and README.md.

Keep POST /api/process-meeting with multipart audio and geminiApiKey. Use native fetch and the existing dependencies. Upload in-memory audio through Gemini Files API (resumable start + upload/finalize), wait for file readiness only if needed, then make one foreground non-streaming Interactions request to gemini-3.5-transcribe with store:false. Configure generation_config.transcription_config.mode as verbatim with diarization_mode:"speaker" and timestamp_granularities:["word"]. Do not use smart mode, custom vocabulary, a live model, background jobs or the old Soniox job polling/deletion. Follow the current official REST revision consistently; do not mix Interactions and Generate Content field names or response envelopes.

Parse completed text and word_info annotations from documented model-output steps. Convert duration offsets to milliseconds, map speaker IDs consistently, and build readable chronological segments. Missing speaker is Unknown speaker; never invent timestamps. Nonempty speech with unusable timing, blocked/truncated/noncompleted results are STT errors. Completed empty speech returns no_speech and skips summary. Keep format normalization for MP3/WAV/M4A/WebM, including MediaRecorder codec parameters, without transcoding.

Retarget the existing structured Generate Content summary adapter to gemini-3.5-flash-lite. Send normalized transcript only, keep grounding/ownership/deadline/language rules and runtime validation, and preserve the transcript with summary_failed if summary fails. Keep the existing MeetingResult shape, summaryError, warnings and plain-text JSON rendering. Completed, summary_failed and no_speech must remain distinguishable.

Keep the 20 MiB cap, recording auto-stop at 5 minutes, browser resource cleanup, input locks/in-flight guard, stale-response protection and accepted UX. Keep provider fetches/result responses no-store, keys in headers, and secrets/transcript bodies out of logs/errors. Use the design's bounded deadlines (STT phase 180s, summary 60s, cleanup 10s total). Delete only the uploaded Gemini file owned by this attempt after STT settles, with bounded best-effort cleanup that cannot hide the primary outcome. Surface cleanup warnings; do not claim zero retention or guaranteed remote cancellation.

Update UI copy and README to one Gemini key and the new pipeline. The PNG wireframe is legacy visual guidance; ignore its obsolete provider/key fields. Preserve existing optional preview/Copy JSON if already implemented. No model selectors, Test Connection, new endpoints, persistence for meetings, queues, streaming or production deployment. Remove obsolete Soniox code only after replacing references safely.

Read official documentation as needed:
https://ai.google.dev/gemini-api/docs/transcribe
https://ai.google.dev/gemini-api/docs/files
https://ai.google.dev/gemini-api/docs/interactions
https://ai.google.dev/gemini-api/docs/generate-content/structured-output
https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite

Do not make real Gemini API calls, run automated/manual/browser tests, add tests/test infrastructure or create test-case documents; the user owns runtime verification per PRD. Static lint/type checks are allowed: run bun run lint and bunx tsc --noEmit when feasible and report actual results without claiming end-to-end success. Do not commit, publish or deploy.

Complete the migration rather than returning only a plan. Handoff concisely: files/behavior changed, static-check results, remaining blockers and unverified provider/model access, transcription accuracy and latency. If official documentation materially contradicts the spec, identify the exact discrepancy rather than silently substituting models or fabricating response fields.
```
