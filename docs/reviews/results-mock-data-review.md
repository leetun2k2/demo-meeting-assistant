# Results mock data review

Scope: static review of `/results` and its data producers. No application code changed; browser state and live Gemini calls were not tested.

## Findings

- **High — Mock fallback leaks into real failed results.** `components/OutputPage.tsx:430-441,801,819,919`: missing summary renders sample title, executive summary, discussions, decisions, action items and default counts (2 decisions, 3 tasks, 3 speakers). Both `summary_failed` and `no_speech` can return null summaries. Render explicit failure/empty states instead.
- **High — Ask AI is scripted.** `components/OutputPage.tsx:407-424`: keyword matching returns train/travel answers without reading the transcript or calling an API, including with real results.
- **High — Insights contain unconditional sample content.** `components/OutputPage.tsx:840-875,1212,1225`: risks, next milestones, themes and core insights always describe the sample travel meeting. Bind supported sections to summary fields; omit unsupported data.
- **High — Follow-up email mixes real and sample content.** `components/OutputPage.tsx:1409`: actual title/summary combined with fixed train decisions/tasks, ignoring `summary.followUpEmail`. Line 1425 copies only a placeholder sentence rather than the displayed draft.
- **Medium — Date, duration and speaker contribution are misleading.** `components/OutputPage.tsx:283-305,441,496`: date fixed to Jan 30, 2025 and duration to 32 minutes. Real speaker percentages use text character counts, then multiply by 32 minutes rather than measured speech time. Empty transcripts show sample speaker breakdown.
- **Medium — Action buttons are simulations.** `components/OutputPage.tsx:517,525,534`: Assign Owner, Mark Complete and Sync to Tools only show toast notifications; no assignment, persistence or integration occurs.
- **Low — Other synthetic indicators.** `components/OutputPage.tsx:250,264-265,574,598,640,670`: fourth transcript segment pre-starred, default assignee Speaker 3/deadline Today, unconditional Gemini verification/100% agreement/clear audio labels, decorative waveform unrelated to audio samples.

## Intentional demo and real data flow

`lib/meeting/wireframeData.ts:10,111` holds the full sample result and metadata. `app/results/page.tsx:14-36` uses this when localStorage `meeting-assistant.lastResult` is absent, invalid or inaccessible. Valid cached results set `isDemo=false`; the unguarded findings above still apply. Editing demo tasks persists the sample as a normal cached result; a reload loses the demo marker because provenance is not stored.

`components/MeetingWorkspace.tsx:385-408` uploads audio to `/api/process-meeting`, stores the response, and navigates to `/results`. The route calls Gemini upload/transcription and summarization; `/api/summarize-meeting` provides a real summary retry. Transcript, JSON export, and summary-bound fields use the current result, whose origin can be real or demo.

## Suggested order

First remove sample fallbacks from real failure/empty states. Then bind insights and email to real summary fields. Correct metadata and contribution calculations, and clearly label or disable scripted actions/Ask AI until implemented.
