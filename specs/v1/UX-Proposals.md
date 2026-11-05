# Low-effort UX proposals — demo MVP

Date: 2026-11-05  
Status: Accepted and incorporated into PRD v2.3 and Technical Design. Native preview and Copy JSON remain optional P1; elapsed timer remains optional. API-key persistence was subsequently changed by explicit user request; the original refresh-clearing recommendation is superseded by the saved-key copy below.

Reviewed [PRD v2.1](PRD.md), [Technical Design](Technical-Design.md), [Requirement Findings](Requirement-Findings.md), [wireframe](wireframe.png), [README](../README.md), and repository agent instructions. This is a document/wireframe review, not an executed usability review. Effort below is relative judgment, not a measured estimate.

Provider update: one saved Gemini API key now powers fixed `gemini-3.5-transcribe` STT and `gemini-3.5-flash-lite` summary. The legacy wireframe’s two-key provider configuration is superseded by PRD v2.3.

The current one-page flow is suitable. Improve copy, native controls and result presentation without changing the provider pipeline or adding dependencies.

## Recommended first

| Proposal | Concrete behavior | Why it helps / effort |
| --- | --- | --- |
| Explain disabled processing | Keep a short message beside Process Meeting: “Add your Gemini API key and record or upload audio.” Adapt to the missing prerequisite. While recording: “Stop recording before processing.” | Makes existing validation understandable. Very low: derive text from existing state. PRD FR-04 already defines the prerequisites. |
| Put input limits where users choose audio | Upload helper: “MP3, WAV, M4A or WebM · Max 20 MiB · Recommended: 5 minutes or less.” Recording timer: “00:32 / 05:00”; after auto-stop: “5-minute limit reached. Your recording is ready to process.” Show selected file size beside its name. | Avoids discovering constraints through errors. Very low: copy and formatting of existing values; no upload-duration inspection. |
| Keep secondary output out of the way | Show summary, decisions/action items and transcript normally; place Raw JSON in a collapsed native details section. On summary failure show the warning and transcript directly. | Preserves the PRD's output priority with less scrolling and fewer custom controls than the wireframe's output tabs. Very low. No automatic configuration collapse or hidden transcript. |
| Make empty and partial outcomes explicit | Completed empty sections say “No decisions identified” / “No action items identified.” Partial success says “Transcript ready. Summary could not be generated.” Add a relevant recovery sentence for invalid keys, mic denial or invalid audio. | Distinguishes successful absence from failed generation. Very low; refines already-required states rather than adding features. |

For microphone denial, suggest allowing microphone access or choosing Upload Audio. For a summary failure, state that Process Meeting runs transcription again; do not imply a summary-only retry. Keep errors near the affected field/section. A no-speech result should suggest checking the microphone or selecting another recording.

## Small optional additions

| Proposal | Concrete behavior | Effort and scope |
| --- | --- | --- |
| Native audio preview | One browser audio player for the current recording/file, before Process Meeting, with no autoplay. If Chrome cannot preview a selected format, explain that and still permit processing. | Low: native audio controls plus object-URL lifecycle already anticipated in the design. Existing P1; retain optional status. No waveform/custom player. |
| Copy JSON with feedback | Copy the same JSON displayed in the results; briefly show “Copied.” If clipboard permission fails, leave selectable JSON and a clear message. | Low. Existing P1; no new export format or library. |
| Better waiting feedback | Button reads “Processing…”; nearby text says “Keep this page open; processing may take a few minutes.” Optionally show elapsed time, clearly labeled as elapsed rather than estimated remaining time. | Text is very low effort; elapsed timer is a small optional addition. Preserve the single-request architecture: do not display guessed STT/summary stage transitions or fake percentages. |

## Basic presentation details

Use visible labels, native buttons and visible keyboard focus. Keep speaker text alongside speaker colors. Use a polite status region for completion/waiting updates and an alert for actionable failures; do not announce a timer every second. Native [status semantics](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role) support non-disruptive announcements.

Add a short factual note near configuration: “Your Gemini API key is saved in this browser. Audio goes to Gemini 3.5 Transcribe and the transcript goes to Gemini 3.5 Flash-Lite when you process.” This explains the existing data flow without claiming providers retain nothing. Keep English interface copy consistent while summary language follows the meeting as required. Keep the existing fonts and light-theme direction.

The native [details element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) supplies disclosure behavior, and [audio controls](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio) supply browser playback controls; the proposed low effort relies on using these primitives rather than building custom components.

## Scope recommendation

Include the four first recommendations as refinements to existing behavior. If time remains, prioritize native preview, then Copy JSON; waiting copy is cheap enough to include without the optional timer. These UX choices do not require a backend change, new endpoint, streaming, provider calls or new packages. Separately, the user requested API-key persistence in browser localStorage; PRD v2.3 and Technical Design define restore, clear and unavailable-storage behavior.

The design currently clears audio/results on input-tab switches. Add adjacent copy that switching replaces the current audio, and keep the active input visually obvious. Avoid a confirmation modal for the demo. Preserving audio across tabs would change that design decision and is not proposed here.

README is still boilerplate; its eventual handoff should put Bun startup, required keys and desktop Chrome first, matching PRD §8–9. This is an existing delivery expectation, not an additional UX feature. The resolved findings retain historical ambiguities but clearly mark their resolution, so they should not reopen scope.

The accepted refinements are now in the PRD and Technical Design. Existing P1 priorities remain; no wireframe was replaced, and no implementation, runtime tests or provider calls were performed.
