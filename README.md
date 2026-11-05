# AI Meeting Assistant (POC)

A one-page demo that records or uploads a short meeting recording, transcribes it with
Gemini 3.5 Transcribe (with speaker diarization and word-level timestamps), and turns it into
a Meeting Intelligence Output Page with Gemini 3.5 Flash-Lite: an executive summary,
automatic speaker-name resolution, decisions, action items, risks, unresolved questions, key
moments, suggested next steps and a follow-up email draft. Built per
[`specs/v1/PRD.md`](specs/v1/PRD.md) and [`specs/v2/PRD.md`](specs/v2/PRD.md); see each
version's `Technical-Design.md` and `Implementation-Plan.md` for the accepted design.

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
3. Press **Process Meeting**. This uploads audio to Gemini Files → Gemini 3.5 Transcribe
   (verbatim, speaker diarization, word timestamps) → Gemini 3.5 Flash-Lite Meeting
   Intelligence extraction, then **navigates you to a dedicated Output Page at `/results`**
   once a result comes back (any outcome — completed, summary_failed, or no_speech). The
   `/`  page stays a plain input form; nothing is shown inline there anymore. A "View last
   result →" link appears on `/` whenever a previous result is still saved, so you can get
   back to it without reprocessing.
4. The Output Page (`/results`) shows, in priority order: a title and executive summary with
   duration/speaker/decision/action-item counts; Key Discussion Points, Decisions Made (each
   can link to the moment in the transcript it came from), and an editable, completable Action
   Items table; then Risks & Blockers, Unresolved Questions, Key Moments and Suggested Next
   Steps; Quick Actions (copy the summary or action items, download JSON/Markdown, or reveal a
   generated follow-up email draft); a searchable/filterable Transcript (with a "Play from
   here" jump into the audio when it's still in memory); and a collapsed Raw JSON section.

Switching between Record/Upload, or replacing the audio, clears the current audio (the input
form has no results to clear anymore). The key, inputs and the input tabs are locked while a
request is in flight.

### Speaker names

Each diarized speaker is resolved to a real name only when the transcript gives direct
evidence that speaker is that person (a self-introduction, or an unmistakable reply context);
otherwise it's shown as "Person N" rather than guessed. The same name is used consistently in
the Transcript and in Action Items. This is a content-based inference, not voice/biometric
identification.

### Result states

- **completed** — transcript + the full Meeting Intelligence summary; every empty list (no
  decisions, no risks, etc.) is shown explicitly as "No … identified." rather than hidden.
- **summary_failed** — transcription succeeded but Gemini didn't return a usable summary; the
  transcript is still shown, with a **Retry Summary** button (see below).
- **no_speech** — no recognizable speech was found; the summary model is not called.

Action-item edits (task/assignee/deadline text, the done checkbox) are saved into the same
on-screen result and persist across a reload the same way the rest of the result does (see
below) — they are not sent back to Gemini and don't survive a new Process Meeting attempt.

### Retrying a failed summary

A `summary_failed` result shows a **Retry Summary** button on the Output Page. This calls a
separate endpoint, `POST /api/summarize-meeting`, with the transcript already on screen and
your Gemini key — it re-runs only the Flash-Lite summarization call, **not** the audio upload
or Transcribe step, so a transient failure (for example a `503` "model currently experiencing
high demand" from Flash-Lite, which is common enough to be worth a dedicated button) doesn't
cost you another transcription. Success replaces the summary in place; another failure just
updates the shown error so you can retry again.

### Result persistence

The latest result (whichever of the three states above) is mirrored to `localStorage`, so
reloading `/results` restores it instead of showing "No meeting result found." This is a
deliberate deviation from the PRD's original "no result persistence" scope, added on request.
It is overwritten by each new Process Meeting outcome, by a successful/failed summary retry,
and by action-item edits. Audio is still never persisted to `localStorage` — see "Audio across
the navigation to `/results`" below — and there's still no history: only the single most
recent result survives.

### Audio across the navigation to `/results`

The recorded/uploaded audio `Blob` can't be put in `localStorage` (it isn't JSON), so it's
handed to `/results` through a small in-memory, module-level variable
(`lib/meeting/audioSession.ts`) that survives the one client-side navigation from `/` to
`/results`. This is what makes "Play from here" / jump-to-audio work right after Process
Meeting completes. It resets on a full page reload or a new tab — reopening `/results` later
(including via "View last result") still shows the full result, just without audio playback,
exactly like v1's existing "audio is session-only" behavior.

## What this is not

Per the PRD, this is a one-time proof-of-concept, not a production app:

- No login/accounts, no database, no server-side persistence. The only persisted browser data
  is the Gemini API key and the single latest result (see above) — audio is never persisted.
- No meeting history, realtime transcription, live collaboration, or transcript editing.
  Action-item edits and JSON/Markdown export/copy are implemented (see above); nothing else is
  editable.
- Fixed provider models (`gemini-3.5-transcribe`, `gemini-3.5-flash-lite`), no model picker,
  no "Test Connection" step.
- No retry for a failed transcription — only a failed *summary* can be retried on its own (see
  "Retrying a failed summary" above); if Transcribe itself fails, Process Meeting on `/` still
  has to run the whole pipeline again.

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
- **v2 Meeting Intelligence schema has been exercised once against a live Gemini account**
  (a real 48s recording, upload → Transcribe → Flash-Lite). Diarization, timestamps,
  discussions, decisions, risks, and the "Person N" fallback (correctly used throughout, since
  this recording's speakers never identified themselves by name) were all correct. One real
  bug was found and fixed from that run: Flash-Lite referred to an unresolved speaker as the
  raw `"Speaker N"` label inside prose fields (executive summary, key moments) instead of the
  `"Person N"` convention used in the Transcript/Action Items, which `lib/meeting/gemini.ts`
  now corrects with a post-processing pass (`applySpeakerNamesToSummary`) rather than relying
  on prompt compliance alone — confirmed against the exact text that run produced, but **not
  yet re-confirmed end-to-end**: three follow-up attempts against the same file all hit a
  transient `503` ("model currently experiencing high demand") from Flash-Lite before
  reaching this code path, which is a provider-side condition, not an application bug (the
  existing `summary_failed` handling reported it correctly each time). Still unverified with a
  real account: whether Flash-Lite reliably returns exactly one `speakerNames` entry per
  listed speaker label when some speakers *are* identifiable by name, whether `atMs`
  references consistently land close enough to the right transcript line to be a useful "jump"
  target, and whether Suggested Next Steps reliably stay distinct from Action Items.
- **Meeting duration** is estimated from the last transcript segment's end time, not read from
  the audio file itself — `MediaRecorder`-produced recordings can report an unreliable/`Infinity`
  native duration before being seeked, so this estimate is used instead everywhere duration is
  shown. It is a lower bound on the actual recording length, not an exact value.

### Delivered vs. omitted

**v1 scope:** All P0 requirements (single Gemini key configuration, Record + Upload, Process
Meeting, Gemini 3.5 Transcribe + diarization, Gemini 3.5 Flash-Lite summarization,
summary/action-items/transcript display, Raw JSON) are implemented. P1 extras are also
implemented: native audio preview, Copy JSON, and an elapsed-time indicator while processing.

**v2 scope (Meeting Intelligence Output Page):** All P0 requirements are implemented —
executive summary, automatic speaker-name resolution (falling back to "Person N"), Key
Discussion Points, Decisions Made, an editable/completable Action Items table, and a
searchable/filterable Transcript Viewer with jump-to-audio when the recording is still in
memory. All P1 requirements are also implemented: Risks & Blockers, Unresolved Questions, Key
Moments (click to jump), Suggested Next Steps, and the full set of Post-Meeting Actions (Copy
Summary, Copy Action Items, Download JSON, Download Markdown, Generate Follow-up Email).
Nothing from either PRD's P0/P1 scope was intentionally omitted. The wireframe's product-shell
elements not in the PRD text (multi-meeting navigation, Jira/Notion sync, Share, Translate,
an AI-chat follow-up, a speaker-breakdown chart, a timeline widget) were intentionally not
built — see [`specs/v2/Requirement-Findings.md`](specs/v2/Requirement-Findings.md) finding 1.

### Static checks run

- `bunx tsc --noEmit` — passes.
- `bun run lint` — passes.

These are compilation/static checks only, not functional or provider-integration tests —
runtime verification with a real Gemini API key is left to you, per the PRD.
