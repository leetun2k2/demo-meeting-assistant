import { ALLOWED_AUDIO_EXTENSIONS, ALLOWED_AUDIO_MIME_TYPES } from "@/lib/constants";

export function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot + 1);
}

// Browser MIME labels can be missing or generic (e.g. "application/octet-stream"),
// so an allowed extension is accepted when MIME metadata is inconclusive. A MIME type
// that is clearly not audio is rejected even if the extension looks right. This is a
// screening check only; actual decodability is determined by the provider.
export function hasAllowedAudioFormat(filename: string, mimeType: string): boolean {
  const ext = getExtension(filename);
  const extOk = (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
  const mime = (mimeType || "").toLowerCase();

  if (!mime || mime === "application/octet-stream") return extOk;
  if ((ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime)) return true;
  if (mime.startsWith("audio/")) return extOk;
  return false;
}

// maxBytes is caller-supplied (upload vs. recording have different caps in v3) rather than a
// single module-level constant, so one check serves both without implying they share a limit.
export function isAudioSizeAllowed(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxBytes;
}
