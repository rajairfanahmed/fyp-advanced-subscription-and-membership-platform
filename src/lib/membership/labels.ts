import type { PlanAccessLevel } from "@/types/plan";

export const PLAN_TIER_RANK: Record<PlanAccessLevel, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export function planTierLabel(level: string | null | undefined): string {
  if (level === "premium") return "Premium";
  if (level === "basic") return "Basic";
  return "Free";
}

export function daysRemaining(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const end = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export function daysRemainingLabel(
  iso: string | Date | null | undefined,
  opts?: { ending?: boolean }
): string {
  const days = daysRemaining(iso);
  if (days === null) return "";
  if (opts?.ending) {
    if (days === 0) return "Ends today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  }
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  return `Renews in ${days} days`;
}
