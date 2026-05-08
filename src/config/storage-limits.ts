// Client-safe mirror of the storage limits enforced server-side in
// `src/lib/storage/r2.ts`. We keep the numbers in sync here so the
// upload UI can render hints ("Max 500 MB") and reject obvious
// oversized files before kicking off the network request, while the
// server `STORAGE_FILE_RULES` remains the source of truth for the
// final validation. Updating one without the other would only let a
// file slip past the hint — the upload route still rejects it with
// an HTTP 413.
export const MEGABYTE = 1024 * 1024;

export const STORAGE_LIMITS = {
  imageMaxBytes: 8 * MEGABYTE,
  videoMaxBytes: 500 * MEGABYTE,
  downloadableMaxBytes: 200 * MEGABYTE,
} as const;

export type StorageLimitKey = keyof typeof STORAGE_LIMITS;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
