import { connectToMongoDB } from "@/lib/mongodb/connect";
import { SubscriptionModel } from "@/lib/mongodb/models";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import {
  upsertPaymentFromInvoice,
  upsertSubscriptionFromStripe,
} from "@/lib/stripe/webhook";
import type Stripe from "stripe";

async function persistListedInvoice(invoice: Stripe.Invoice) {
  if (!invoice.id || invoice.status === "draft") return;
  if (invoice.status === "paid") {
    await upsertPaymentFromInvoice(invoice, "succeeded");
    return;
  }
  if (invoice.status === "uncollectible") {
    await upsertPaymentFromInvoice(invoice, "failed");
    return;
  }
  if (
    invoice.status === "open" &&
    (invoice.attempt_count ?? 0) > 0 &&
    !invoice.next_payment_attempt
  ) {
    await upsertPaymentFromInvoice(invoice, "failed");
  }
}

/**
 * Pull Stripe invoices into the local payments table for a subscriber
 * or creator. Used when billing/revenue pages load so receipts appear
 * even if `invoice.paid` never reached this deployment.
 */
export async function syncStripePayments(filter: {
  subscriberClerkUserId?: string;
  creatorClerkUserId?: string;
}): Promise<void> {
  if (!isStripeConfigured()) return;
  if (!filter.subscriberClerkUserId && !filter.creatorClerkUserId) return;

  try {
    const stripe = getStripeClient();
    await connectToMongoDB();

    const query: Record<string, unknown> = {
      stripeSubscriptionId: { $ne: "" },
    };
    if (filter.subscriberClerkUserId) {
      query.subscriberClerkUserId = filter.subscriberClerkUserId;
    }
    if (filter.creatorClerkUserId) {
      query.creatorClerkUserId = filter.creatorClerkUserId;
    }

    const subs = await SubscriptionModel.find(query)
      .select({ stripeSubscriptionId: 1, stripeCustomerId: 1 })
      .limit(40);

    const seenSubs = new Set<string>();
    const seenCustomers = new Set<string>();

    for (const sub of subs) {
      const stripeSubId = (sub.stripeSubscriptionId ?? "").trim();
      if (stripeSubId && !seenSubs.has(stripeSubId)) {
        seenSubs.add(stripeSubId);
        try {
          const live = await stripe.subscriptions.retrieve(stripeSubId);
          await upsertSubscriptionFromStripe(live);
        } catch (error) {
          console.warn("[stripe:sync:subscription]", stripeSubId, error);
        }
        try {
          const invoices = await stripe.invoices.list({
            subscription: stripeSubId,
            limit: 24,
          });
          for (const invoice of invoices.data) {
            await persistListedInvoice(invoice);
          }
        } catch (error) {
          console.warn("[stripe:sync:invoices]", stripeSubId, error);
        }
      }

      const customerId = (sub.stripeCustomerId ?? "").trim();
      if (customerId && !seenCustomers.has(customerId)) {
        seenCustomers.add(customerId);
        try {
          const invoices = await stripe.invoices.list({
            customer: customerId,
            limit: 24,
          });
          for (const invoice of invoices.data) {
            await persistListedInvoice(invoice);
          }
        } catch (error) {
          console.warn("[stripe:sync:customer-invoices]", customerId, error);
        }
      }
    }
  } catch (error) {
    console.warn("[stripe:sync:payments]", error);
  }
}
