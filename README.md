# AI Meeting Assistant (POC)

A one-page demo that records or uploads a short meeting recording, transcribes it with
Gemini 3.5 Transcribe (with speaker diarization and word-level timestamps), and summarizes
it with Gemini 3.5 Flash-Lite into discussion points, decisions and action items. Built per
[`specs/PRD.md`](specs/PRD.md); see [`specs/Technical-Design.md`](specs/Technical-Design.md)
and [`specs/Implementation-Plan.md`](specs/Implementation-Plan.md) for the accepted design.

## Getting started

```bash
bun install
bun dev
```

Open http://localhost:3000 in **current desktop Chrome** (the only browser target for this
demo). No build step or environment variables are required to start the app — the API key is
entered in the UI.

## Required key

You need your own **Gemini API key**, used for both stages of the pipeline:

- Speech-to-text + speaker diarization (`gemini-3.5-transcribe`)
- Meeting summarization (`gemini-3.5-flash-lite`)

Paste it into the Configuration section. It is sent to this app's own server only when you
press **Process Meeting**, and from there directly to Gemini over HTTPS; the server does not
store it beyond the lifetime of that one request.

### Browser key storage

The key is saved to this browser's `localStorage` (`meeting-assistant.geminiApiKey`) so you
don't have to re-enter it on every reload. This is a convenience for local demo use, **not
secure storage**:

- The value is stored in plain text; the password-style input only hides it on screen.
- Anything with access to this browser profile/origin can read it.
- **Clear saved keys** removes the input and the stored entry.
- If storage is unavailable (private browsing, disabled storage, etc.), the key still works
  for the current tab but you'll see "Your API key could not be saved in this browser.";
  processing is not blocked.
- Audio is **never** persisted — it lives only in page memory and is lost on refresh.
- The most recent result is saved to `localStorage` (`meeting-assistant.lastResult`) so a
  refresh doesn't lose it; see [Result persistence](#result-persistence) below. There is still
  no history — only the latest attempt is kept, and it's overwritten/cleared the same way the
  on-screen result is.
- On first load, the app best-effort removes a legacy `meeting-assistant.sonioxApiKey` entry
  left over from an earlier two-provider version of this demo; its value is never read.

## Using the app

1. **Record Audio** — click Start Recording, allow microphone access, speak, then Stop
   Recording (or let it auto-stop at 5:00). Record Again discards the current take.
2. **Upload Audio** — choose a local MP3/WAV/M4A/WebM file (max 20 MiB; 5 minutes or less
   recommended — duration isn't inspected, only file size is enforced).
3. Press **Process Meeting**. This runs the full pipeline every time: upload audio to Gemini
   Files → Gemini 3.5 Transcribe (verbatim, speaker diarization, word timestamps) → Gemini
   3.5 Flash-Lite summarization. There is no stage-level retry — if anything fails, fix the
   input/key and press Process Meeting again.
4. Results appear in priority order: Meeting Summary, Decisions, Action Items, Transcript,
   then a collapsed Raw JSON section (with a Copy JSON button).

Switching between Record/Upload, or replacing the audio, clears the current audio and
results. The key, inputs and the input tabs are locked while a request is in flight.

### Result states

- **completed** — transcript + summary (discussions/decisions/action items; empty lists are
  shown explicitly as "No decisions identified" / "No action items identified.").
- **summary_failed** — transcription succeeded but Gemini didn't return a usable summary; the
  transcript is still shown, with a warning explaining that Process Meeting will re-run the
  whole pipeline (not just the summary) if you try again.
- **no_speech** — no recognizable speech was found; the summary model is not called.

### Result persistence

The latest result (whichever of the three states above) is mirrored to `localStorage` as it
appears on screen, so reloading the page restores it instead of showing a blank workspace.
This is a deliberate deviation from the PRD's original "no result persistence" scope, added on
request. It is overwritten on every new Process Meeting outcome and removed whenever the
on-screen result is cleared — switching Record/Upload tabs, replacing the audio, or starting a
new attempt — the same triggers that already clear the in-memory result. Audio is still never
persisted, and there's still no history: only the single most recent result survives.

## What this is not

Per the PRD, this is a one-time proof-of-concept, not a production app:

- No login/accounts, no database, no server-side persistence. The only persisted browser data
  is the Gemini API key and the single latest result (see above) — audio is never persisted.
- No meeting history, realtime transcription, live collaboration, transcript editing, or
  export beyond copying the displayed JSON.
- Fixed provider models (`gemini-3.5-transcribe`, `gemini-3.5-flash-lite`), no model picker,
  no "Test Connection" step.

## Known limitations / unverified behavior

The pipeline has since been exercised against a live Gemini account (upload → Transcribe →
Flash-Lite summary) and produced a correct diarized transcript, timestamps and summary end to
end. Two points below were corrected based on that live run; everything else is still
implemented from documentation only, not independently re-verified:

- **Provider access and exact wire format.** The Gemini Files/Interactions/Generate Content
  request and response shapes were implemented from current public documentation (fetched
  during implementation), then corrected where a live call disagreed with it (see below).
  Account eligibility for the two fixed models was confirmed once for one account; it is not
  guaranteed for every account.
- **File-readiness polling was intentionally not implemented.** The Technical Design assumed
  a Soniox-style "check file state, wait for ACTIVE" step after upload. The current Gemini
  Files API reference does **not** document a `state` field on the uploaded file object, so
  this implementation treats the file as usable for inference immediately after the upload
  finalize response returns. The one live run completed successfully without a readiness
  wait; a larger/slower upload on a different account could still behave differently.
- **Transcribe input shape — documentation was wrong, fixed against a live 400 response.**
  The fetched Transcribe guide's own REST example showed `{type: "file", file_uri}`. The real
  API rejected that twice: first `"file"` is not a valid `type` (its enum includes `"audio"`,
  not `"file"`), then `file_uri` is an unknown parameter once `type` is `"audio"`. The working,
  live-confirmed shape is `{type: "audio", uri: fileUri}` — no `mime_type` field needed in the
  Interactions request body (the MIME type is set once, during the Files upload).
- **`Api-Revision: 2026-05-20`** is sent only on the `POST /v1beta/interactions` call, per the
  one documented example that shows this header; it is not sent on Files API calls, which
  show no such header in the reference. This header was not implicated in the 400s above.
- **Timing.** A 5-minute recording, a 20 MiB upload, Gemini Files upload + Transcribe (180s
  budget) and Flash-Lite summarization (60s budget) are not guaranteed to complete inside
  those windows for your account/network.
- **Cleanup is best-effort, not guaranteed.** The server tries to delete the uploaded Gemini
  file after the Transcribe call settles (success, provider error, or local timeout) — unlike
  the previous Soniox job model, there is no separate job state that would make deletion
  unsafe. A crashed server process, a lost upload response, or a failed delete call can still
  leave the file behind until its 48-hour expiry.
- **Audio format screening, not decoding proof.** MIME-type/extension checks only gate
  obviously unsupported files; an accepted file can still fail at Gemini if it can't actually
  decode it, which surfaces as a transcription error.
- **Semantic accuracy of the summary** (correct speaker attribution, correct decisions/action
  items) is not verified — structured JSON output constrains shape, not truthfulness.
- Mixed Vietnamese/English meetings, diarization quality (3+ speakers is documented as
  experimental), word-timestamp accuracy, and recording codec compatibility across machines
  are unverified.

### Delivered vs. omitted

All P0 requirements (single Gemini key configuration, Record + Upload, Process Meeting,
Gemini 3.5 Transcribe + diarization, Gemini 3.5 Flash-Lite summarization,
summary/action-items/transcript display, Raw JSON) are implemented. P1 extras are also
implemented: native audio preview, Copy JSON, and an elapsed-time indicator while processing.
Nothing from the PRD's P0/P1 scope was intentionally omitted.

### Static checks run

- `bunx tsc --noEmit` — passes.
- `bun run lint` — passes.

These are compilation/static checks only, not functional or provider-integration tests —
runtime verification with a real Gemini API key is left to you, per the PRD.
