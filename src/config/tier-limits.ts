import type { PlanAccessLevel } from "@/types/plan";

/**
 * Per-tier platform feature limits enforced by the backend (download
 * quotas, content access, etc.) and surfaced in the UI so subscribers
 * always know what their current tier includes.
 *
 * IMPORTANT: This file is the single source of truth. Both the API
 * (e.g. /api/content/[id]/download) and the subscriber UI (e.g.
 * /subscription, /library) read from it — never duplicate these
 * numbers in component-level constants or copy.
 */

export type TierLimits = {
  /** Max downloads allowed per 30-day rolling window per (subscriber, creator). */
  monthlyDownloads: number;
  /** Whether the tier is allowed to download files at all. */
  canDownload: boolean;
  /** Unused by UI — kept so serialized limits stay stable. */
  prioritySupport: boolean;
  /** Marketing label for the tier shown in the subscriber dashboard. */
  label: string;
  /** Concrete, user-visible feature list shown on /subscription. */
  features: string[];
};

/**
 * Sentinel value for "no practical cap" — using `Number.POSITIVE_INFINITY`
 * keeps quota arithmetic short-circuiting while staying serialisable as
 * `null` over JSON (we coerce in `serializeTierLimits`).
 */
export const UNLIMITED_DOWNLOADS = Number.POSITIVE_INFINITY;

export const TIER_LIMITS: Record<PlanAccessLevel, TierLimits> = {
  free: {
    monthlyDownloads: 5,
    canDownload: true,
    prioritySupport: false,
    label: "Free",
    features: [
      "Watch free articles and video previews.",
      "Up to 5 free-tier file downloads per creator each month.",
      "Standard creator updates.",
    ],
  },
  basic: {
    monthlyDownloads: 30,
    canDownload: true,
    prioritySupport: false,
    label: "Basic",
    features: [
      "Watch free + basic videos and articles.",
      "Up to 30 file downloads per creator each month.",
      "PDF, ZIP, and RAR downloads.",
    ],
  },
  premium: {
    monthlyDownloads: UNLIMITED_DOWNLOADS,
    canDownload: true,
    prioritySupport: true,
    label: "Premium",
    features: [
      "Watch every tier of content from the creator.",
      "Unlimited file downloads.",
      "Every file download from that creator.",
    ],
  },
};

/** Length of the rolling quota window. 30 days, matching the subscription billing cycle. */
export const QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * JSON-friendly view of a tier's limits. Used by client components to
 * render quota copy without importing `Number.POSITIVE_INFINITY`.
 */
export type SerializedTierLimits = Omit<TierLimits, "monthlyDownloads"> & {
  monthlyDownloads: number | null;
};

export function serializeTierLimits(level: PlanAccessLevel): SerializedTierLimits {
  const base = TIER_LIMITS[level];
  return {
    ...base,
    monthlyDownloads:
      base.monthlyDownloads === UNLIMITED_DOWNLOADS ? null : base.monthlyDownloads,
  };
}
