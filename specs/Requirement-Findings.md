# Requirement Findings — AI Meeting Assistant

Reviewed: 2026-11-05  
Sources at review: PRD v2.0 (now updated to [v2.3](PRD.md)), [wireframe](wireframe.png), and the current starter page in `app/page.tsx`.  
Status: Resolved for demo MVP. The user delegated the choices with “auto choose, keep simplest for demo MVP.” Decisions are incorporated into PRD v2.1. Original findings below retain the review rationale; proposed/needed decisions there are historical, superseded by the resolution below.

## Resolution — 2026-11-05

1. PRD governs behavior; wireframe is visual guidance. Use one page without Continue, model selectors, or Test Connection; models are fixed implementation choices.
2. Audio preview is optional P1 for both input methods.
3. Target current desktop Chrome. Accept MP3, WAV, M4A and WebM; cap all audio at 20 MiB. Auto-stop recording at 5 minutes without submitting. Recommend uploads of 5 minutes or less, but enforce size only for uploads to avoid duration-metadata complexity. These are chosen demo bounds, not verified provider capabilities.
4. Require explicit task ownership; use a speaker label for self-commitments, an explicitly stated name for named assignments, otherwise Unknown. Preserve relative deadlines verbatim.
5. Require audio and the Gemini key to submit. Lock input changes during processing; clear prior results on audio replacement or a new attempt. Keep transcript on summary failure. UI and JSON distinguish completed, summary_failed and no_speech; unavailable summary is null. Retrying runs the complete pipeline; no stage-specific retry feature.
6. Skip summary inference for no speech, use Unknown speaker for unavailable attribution, and use the first substantive utterance’s language when there is no clear dominant language.

These choices resolve the identified requirement questions for the demo. Provider compatibility, timing and runtime success remain unverified and belong to later technical assessment/user verification. No implementation was requested in this clarification step.

## Subsequent user decisions — PRD v2.2

The user accepted the low-effort UX refinements and explicitly requested saving API keys in browser localStorage for demo convenience. This supersedes the earlier no-key-persistence decision. Restore saved keys on mount, update/remove them on edits, provide Clear saved keys, and fall back to memory when storage is unavailable. Audio/results and server-side keys remain nonpersistent. See PRD FR-01 and §4.2, and Technical Design browser ownership/UX presentation. Preview and Copy JSON remain P1.

## Provider revision — PRD v2.3

The user replaced the original STT provider with `gemini-3.5-transcribe` and selected `gemini-3.5-flash-lite` for summary. One Gemini API key is saved/restored in localStorage for both stages; remove the obsolete STT-provider key/input. Current requirements and plans supersede historical source descriptions below. Transcribe uses diarization and word timestamps; attribution for 3+ speakers is experimental (8 maximum), and timestamps can reduce accuracy. No-speech skips summary, not STT. The old wireframe is legacy visual guidance only; ignore its two-key configuration.

## Original assessment (historical; superseded provider details)

The intended POC is clear: accept recorded or uploaded audio, use Soniox for transcription and speaker labels, use Gemini for grounded meeting analysis, and display both readable results and JSON. The PRD also deliberately delegates runtime verification to the user; this review does not treat that decision as a missing testing requirement.

The requirements support initial technical assessment, but the source conflicts and behavioral ambiguities below should be resolved before treating the complete scope as settled. This is a requirement-clarity assessment, not a feasibility, effort, or implementation-readiness verdict. The current page is the Next.js starter, so it supplies no established meeting-assistant behavior to resolve these questions.

## 1. The wireframe introduces behavior that the PRD does not specify

**Evidence:** The wireframe shows Settings → Input → Output, a Continue button, optional transcription/summary model selectors, and Test Connection. The PRD specifies one page with configuration, input, processing, and results sections, and its feature lists do not include model selection or connection testing ([§4.1](PRD.md#41-screen-layout), lines 237–266; §5, lines 289–321). The wireframe also displays named assignees despite transcript speakers remaining anonymous; these could be illustrative, but must not imply automatic identity recognition.

**Impact:** An implementer cannot tell whether the image adds scope or only illustrates visual grouping. Connection testing also needs its own outcome and failure behavior if included.

**Proposed clarification:** Explicitly establish source precedence. For this timeboxed POC, use the PRD as the behavioral authority and the image as visual guidance; omit model selectors and Test Connection unless separately approved. Confirm whether Continue is merely illustrative or whether a staged interface is intended within the single page. Treat names in the image as examples only, subject to the PRD's grounding rules.

## 2. Audio preview is both required and optional

**Evidence:** Record playback and upload preview are listed as required features in FR-02/FR-03 (lines 87–114), and the recording journey includes playback (line 45). Audio preview is also P1, which may be deferred in favor of P0 (§7, lines 366–373).

**Impact:** Omitting playback can satisfy the priority list while violating the functional requirements.

**Decision needed:** Either make playback required for both input methods, or explicitly mark the playback bullets and journey step as optional. Keeping preview as P1 is consistent with the stated minimum goal of processing audio, but that is a proposal rather than an existing decision.

## 3. The supported audio envelope is undefined

**Evidence:** FR-03 says to prioritize MP3, WAV, M4A, and WebM (line 116), without a mandatory supported set. §6 prefers a single end-to-end request for “short audio” (line 348), but gives no maximum duration or file size. Browser recording has no stop limit (FR-02).

**Impact:** Users can record or select audio outside the intended demo scope, and neither acceptance nor rejection behavior is clear. “Common formats” does not settle what must work.

**Decision needed:** Define the supported browser target, required upload formats, maximum input size/duration, recording behavior at the limit, and the message for unsupported or oversized inputs. Numeric limits should follow technical assessment rather than be invented in this review. A bounded short-meeting demo is consistent with the PRD; unrestricted meeting length is not established.

## 4. Action-item ownership can be mistaken for the person speaking

**Evidence:** FR-05 permits retaining a speaker label when the assignee is not determined (lines 176–182). Its example uses speaker labels as assignees (lines 171–174), while FR-06 forbids inventing real names (line 212). It does not distinguish the speaker assigning a task from the person responsible for doing it.

**Impact:** “Speaker 1: Someone should review the API” could incorrectly become an assignment to Speaker 1. That would undermine the core “What's next?” outcome even if the task itself is accurate.

**Proposed clarification:** Assign work only when the transcript explicitly attributes responsibility. Map an explicit self-commitment to the speaker label; retain an explicitly named assignee without claiming that name identifies a diarized speaker; otherwise show an unknown assignee. Preserve unresolved relative deadlines such as “Friday” as spoken unless meeting-date context is explicitly available. This follows the existing prohibition on guessing deadlines rather than adding date inference.

## 5. Partial success and subsequent attempts lack a clear result lifecycle

**Evidence:** FR-04 and FR-06 require keeping the transcript when Gemini fails (lines 138 and 214). FR-07 requires JSON containing transcript and summary information (lines 218–229), but does not define partial-result representation. Keys can change at any time (line 76), inputs can be replaced or recorded again, and only duplicate submission is explicitly prohibited (line 136).

**Impact:** A failed summary could look like a valid empty list of decisions, or an old summary could appear beside a new transcript. Editing input while processing can make it unclear which recording produced the displayed result.

**Proposed clarification:** Each processing attempt uses the audio and keys selected when it starts. Results must visibly identify the attempt's audio and must never combine outputs from different attempts. Distinguish summary failure from a successful summary with no decisions/action items in both UI and JSON. Define whether input replacement is disabled during processing or applies only to the next attempt. A retry feature is not required by the current PRD and need not be added to resolve this behavior.

## 6. Empty and unrecognizable audio outcomes are unspecified

**Evidence:** The PRD requires full recognized content, speaker labels, timestamps, and a summary (FR-05/FR-06), plus generic error handling and empty states (lines 137 and 277). It does not define the result for silence, no recognized speech, or speech without an available speaker label. Mixed Vietnamese/English is supported, but the summary must use the meeting's “main language” without defining an equal-language case (lines 133–134 and 178).

**Impact:** An empty transcript could be presented as a successful meeting analysis, and missing speaker attribution could encourage fabricated labels or identity claims.

**Proposed clarification:** Show a distinct no-speech result and do not generate meeting conclusions from an empty transcript. Represent unavailable speaker attribution as unknown, without pretending to identify a speaker. Choose a deterministic summary-language fallback for meetings with no clear dominant language; for example, the language of the first substantive utterance. These are proposed acceptance boundaries, not a demand for perfect transcription or diarization.

## Existing constraints to preserve

- Both input methods share the same result format and processing flow.
- No audio is sent before Process Meeting is pressed.
- Keys never appear in results. The original no-refresh-persistence restriction was superseded by the explicit PRD v2.2 localStorage decision above; audio/results are not written to a database or local filesystem. The PRD does not establish external providers' retention behavior, and this review makes no claim about it.
- No real provider calls, runtime testing, browser verification, or test-document creation during implementation, as explicitly stated in §8. Handoff must distinguish implemented behavior from verified API success (§9).
- Keep the one-time POC scope; these findings do not authorize additional features, architecture, or infrastructure.

The original review did not change source requirements. The subsequent delegated decisions updated PRD v2.1. No implementation, tests or provider calls were performed.
