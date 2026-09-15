"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatAccessUntilDate } from "@/lib/membership/access";
import type { SubscriptionResponse } from "@/types/subscription";

export function PaymentIssueBanner({
  subscriptions,
  onUpdateBilling,
  updating,
}: {
  subscriptions: SubscriptionResponse[];
  onUpdateBilling?: () => void;
  updating?: boolean;
}) {
  const pastDue = subscriptions.filter(
    (s) => s.status === "past_due" && s.accessLevel !== "free"
  );
  if (pastDue.length === 0) return null;
  const first = pastDue[0];
  const until = formatAccessUntilDate(first.currentPeriodEnd);

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 sm:p-6 flex items-start gap-3 sm:gap-4 shadow-sm">
      <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <h3 className="font-bold text-red-900 mb-1">Payment failed</h3>
        <p className="text-sm text-red-800 font-medium leading-relaxed mb-3 break-words">
          We could not charge your card
          {first.creatorName ? ` for ${first.creatorName}` : ""}.
          {until
            ? ` You still have access until ${until}. Update your billing method to stay subscribed.`
            : " Update your billing method to keep access."}
          {pastDue.length > 1 ? ` ${pastDue.length} memberships need attention.` : ""}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          {onUpdateBilling ? (
            <Button
              type="button"
              variant="outline"
              className="bg-white border-red-200 text-red-700 hover:bg-red-50 h-auto py-2 text-xs w-full sm:w-auto"
              onClick={onUpdateBilling}
              disabled={updating}
            >
              {updating ? "Opening Stripe…" : "Update billing method"}
            </Button>
          ) : (
            <Button
              variant="outline"
              href="/billing"
              className="bg-white border-red-200 text-red-700 hover:bg-red-50 h-auto py-2 text-xs w-full sm:w-auto"
            >
              Update billing method
            </Button>
          )}
          <Link
            href="/contact"
            className="text-xs font-bold text-red-800 underline-offset-2 hover:underline self-center"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
