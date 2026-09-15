"use client";

import { Button } from "@/components/ui/Button";
import { formatAccessUntilDate } from "@/lib/membership/access";
import { planTierLabel } from "@/lib/membership/labels";
import type { SubscriptionResponse } from "@/types/subscription";

export function CancelMembershipDialog({
  subscription,
  pending,
  onKeep,
  onConfirm,
}: {
  subscription: SubscriptionResponse | null;
  pending?: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  if (!subscription) return null;
  const isPaid = subscription.accessLevel !== "free";
  const until = formatAccessUntilDate(subscription.currentPeriodEnd);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-membership-title"
      onClick={onKeep}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="cancel-membership-title"
          className="text-xl font-black font-display text-[var(--color-ink)] mb-2"
        >
          Cancel this membership?
        </h3>
        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
          {isPaid
            ? until
              ? `You keep ${planTierLabel(subscription.accessLevel)} access to ${subscription.creatorName} until ${until}. After that date, paid content from this creator will lock. You will not be charged again.`
              : `You keep access until the current billing period ends. After that, paid content from ${subscription.creatorName} will lock.`
            : `You will lose free follow access to ${subscription.creatorName} immediately. You can follow again any time.`}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onKeep}
            disabled={pending}
          >
            Keep membership
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto text-rose-700 border-rose-300 hover:bg-rose-50"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Cancelling…" : isPaid ? "Cancel at period end" : "Cancel now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
