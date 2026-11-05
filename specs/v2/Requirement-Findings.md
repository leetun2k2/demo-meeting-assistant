# Requirement Findings — AI Meeting Assistant: Meeting Intelligence (v2)

Reviewed: 2026-11-05
Sources: [PRD v2.1](PRD.md), [wireframe-after-summarize.png](wireframe-after-summarize.png), current implementation (`app/`, `components/`, `lib/`), and accepted v1 decisions ([Requirement-Findings](../v1/Requirement-Findings.md), [Technical-Design](../v1/Technical-Design.md)).
Status: Resolved for demo MVP. The user delegated the approach with "Cứ chọn cách đơn giản + dễ mà làm. scope là demo" (pick the simplest/easiest way; scope is a demo) — the same delegation pattern used to resolve v1. This review proceeds on the simplest evidenced reading below instead of raising blocking questions, and flags the one material scope conflict that needs an explicit precedence call rather than a silent choice.

## Resolution — 2026-11-05

1. **Source precedence.** The PRD is the behavioral authority; the wireframe is visual guidance only (same rule as v1 finding #1). See finding 1 below for what that excludes.
2. **Scope boundary.** v2 covers only the Output Page / post-meeting experience (per the PRD header). No changes to the Configuration or Audio Input sections, recording/upload flow, or key storage — those stay exactly as implemented in v1.
3. **Single-request architecture, extended schema.** Keep one `gemini-3.5-flash-lite` structured-output call (as today), and extend its response schema to cover all new P0/P1 fields (title, executive summary, speaker-name resolution, risks, unresolved questions, key moments, next steps) instead of adding new endpoints, jobs, or a second model call. No STT change is needed; `gemini-3.5-transcribe` already returns per-speaker word timing.
4. **Speaker-name resolution.** Resolve names once per raw diarized speaker for the whole transcript (consistent with FR-02 rule 3), not per utterance. The Gemini call returns a `{speakerKey → resolvedName | null}` map; a single client-side display function applies it everywhere (transcript, action items, key moments) so AC-05 consistency holds by construction instead of needing separate propagation logic.
5. **Fallback label wording.** The PRD's examples use "Person 1", "Person 2" for unresolved speakers (v1 used "Speaker 1", "Speaker 2" for the same concept). Keep "Speaker N" as the internal/raw key already produced by diarization, and render it as "Person N" wherever it reaches the UI when unresolved — a display-layer rename, not a new concept.
6. **Action item status.** The PRD does not define status values (just "task status"); the wireframe's three-stage To Do / In Progress workflow is exactly the "production-grade task management" the PRD excludes (§5 Out of Scope). Use a binary open/done status, matching AC-08 ("edit and complete action items").
7. **Transcript references.** For decisions, risks, and unresolved questions, "can open/jump to transcript" is phrased as optional ("có thể") in FR-04/FR-07/FR-08; for key moments it's required (FR-09). Return an associated meeting timestamp (reusing the existing `startMs` convention) rather than a segment index, so the client matches it to the nearest transcript segment instead of trusting a model-produced array index.
8. **Follow-up email generation.** FR-11 only requires that the user can produce and copy a draft, not that generation be deferred until clicked. Generate it in the same structured-output call as everything else (one subject/body pair) and have "Generate Follow-up Email" reveal/copy the already-computed draft — avoids a second Gemini round trip and a second loading state for a single-page demo.
9. **Duration and counts.** Meeting duration, speaker count, decision count, and action-item count are derived client-side from the existing transcript/summary data (e.g. last segment's end time, array lengths) — no new model output needed for these.
10. **Audio jump-to-position (FR-06).** Already possible without backend changes: the recorded/uploaded `Blob` is already kept in browser memory after processing (never cleared on `handleProcess`), so the existing `<audio>` element can be seeked by `currentTime`. This is session-only, matching the PRD's "nếu audio còn khả dụng" qualifier — it is not available after a reload, since audio was never persisted (by existing v1 decision) and that is unchanged here.

## 1. The wireframe specifies an entire product shell the PRD puts out of scope

**Evidence:** `wireframe-after-summarize.png` shows a left sidebar (Home / Meetings / Action Items / Knowledge / Settings), a meeting-level "Assign Owner" / "Mark Complete" / "Send / Sync" header, a "Sync to Jira" / "Sync to Notion" action row, a "Translate" quick action, and an "Ask AI Follow-up" chat affordance. The PRD's own Out of Scope list excludes exactly these: "Meeting history", "Workspace collaboration", "External project management integrations", "Authentication và user management", "Advanced analytics" (§5), and its Post-Meeting Actions list (FR-11) names only Copy Summary, Copy Action Items, Download JSON, Download Markdown, and Generate Follow-up Email — no sync, share, translate, or chat actions.

**Impact:** Built literally, the wireframe would imply multi-meeting navigation, external integrations, and collaboration features this demo explicitly excludes and the current one-page app has no architecture for (no auth, no persistence, no routing).

**Resolution:** Per decision 1 above, treat the wireframe as illustrating layout/density/visual grouping only. Implement the Output Page as a new results view inside the existing single-page app (replacing `ResultsPanel`), with only the Quick Actions the PRD actually lists. Omit the sidebar, meeting-level owner/status chrome, Jira/Notion sync, Share, Translate, and the AI-chat affordance. The wireframe's "Speaker Breakdown" donut and "Timeline" track are also not required by any FR and read as the kind of decorative KPI-dashboard element §4 ("Visual Direction") explicitly discourages ("Không biến trang thành một dashboard KPI phức tạp") — key moments are shown as a simple clickable list instead of a timeline widget.

## 2. "Priority" on action items is wireframe-only

**Evidence:** The wireframe's Action Items table has a Priority column; FR-05's field table lists only Task, Assignee, Deadline, Status.

**Resolution:** Omit Priority — not requested by the PRD, and inventing a priority value would conflict with FR-05/FR-11's grounding rules (no fabricated fields).

## Existing constraints to preserve (carried from v1, still binding)

- Keys never appear in results; no server-side key persistence; no audio/results in a database or filesystem.
- No real provider calls, runtime testing, or browser verification were performed during this review or during planning — later implementation must report unverified behavior honestly (same as v1 §8–9).
- Deadlines are preserved verbatim and never fabricated; an unstated deadline is an explicit "Not specified", not a guess (FR-05, same rule as v1).
- Assignee/speaker identity is never inferred from a mentioned name alone (FR-02 Scenario D) — a name is only attached to a speaker key when the transcript gives direct evidence that speaker is that person, never when the name is merely mentioned.
- One POC/demo scope: these findings authorize the Output Page redesign and its Gemini schema extension, not new infrastructure, accounts, or integrations beyond what's listed above.

## Assessment

The v2 PRD is clear enough for technical design once the wireframe/PRD precedence above is fixed (finding 1) — the functional requirements (FR-01–FR-11) and their acceptance criteria are concrete and internally consistent with each other and with the existing v1 architecture. No unresolved product-behavior questions remain that would block design; all ambiguities found were resolvable either from the PRD's own text or from the user's simplicity delegation, and are recorded as resolved decisions above rather than open questions.
