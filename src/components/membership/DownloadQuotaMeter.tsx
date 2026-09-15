"use client";

import { cn } from "@/lib/utils";
import type { SubscriptionDownloadQuota } from "@/types/subscription";

function formatReset(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function DownloadQuotaMeter({
  quota,
  compact,
}: {
  quota?: SubscriptionDownloadQuota | null;
  compact?: boolean;
}) {
  if (!quota) return null;

  const unlimited = quota.monthlyLimit === null;
  const used = quota.usedThisPeriod ?? 0;
  const limit = quota.monthlyLimit ?? 0;
  const remaining = unlimited ? null : Math.max(0, quota.remaining ?? limit - used);
  const pct = unlimited || limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const reset = formatReset(quota.windowEnd);

  return (
    <div className={cn("w-full min-w-0", compact ? "mt-2" : "mt-3")}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          Downloads this month
        </p>
        <p className="text-[11px] font-bold text-slate-600">
          {unlimited
            ? "Unlimited"
            : `${remaining ?? 0} of ${limit} left`}
        </p>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            unlimited
              ? "bg-emerald-500"
              : pct >= 100
                ? "bg-rose-500"
                : pct >= 80
                  ? "bg-amber-500"
                  : "bg-emerald-500"
          )}
          style={{ width: `${unlimited ? 100 : pct}%` }}
        />
      </div>
      {!compact && (
        <p className="text-[11px] font-medium text-slate-500 mt-1.5">
          {unlimited
            ? "Premium file downloads are not capped."
            : `${used} used${reset ? ` · resets ${reset}` : ""}`}
        </p>
      )}
    </div>
  );
}
