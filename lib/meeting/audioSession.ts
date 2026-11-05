// In-memory handoff of the just-processed audio Blob from the input workspace ("/") to the
// results page ("/results"), so "jump to audio" works right after Process Meeting completes.
// A plain module-level singleton (not React state, not browser storage) survives a Next.js
// client-side navigation within the same page load — the one hop this needs — and is never
// persisted, resetting on a full reload/new tab. This keeps audio exactly as non-persistent as
// everywhere else in this app; it only bridges one in-app navigation.
let current: { blob: Blob; url: string } | null = null;

export function setSessionAudio(blob: Blob): void {
  if (current) URL.revokeObjectURL(current.url);
  current = { blob, url: URL.createObjectURL(blob) };
}

export function getSessionAudioUrl(): string | null {
  return current?.url ?? null;
}
