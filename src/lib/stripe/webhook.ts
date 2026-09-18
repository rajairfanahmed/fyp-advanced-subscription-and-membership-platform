import type Stripe from "stripe";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  NotificationModel,
  PaymentModel,
  PlanModel,
  SubscriptionModel,
  type SubscriptionDocument,
} from "@/lib/mongodb/models";
import { notifyIfAllowed } from "@/lib/mongodb/notifications";
import { sendUpcomingInvoiceReminder } from "@/lib/mongodb/renewal-reminders";
import { recalcCreatorSubscriberCount } from "@/lib/mongodb/creator-counts";
import { daysRemainingLabel, planTierLabel } from "@/lib/membership/labels";
import type { PlanAccessLevel } from "@/types/plan";
import type { SubscriptionStatus } from "@/types/subscription";

/**
 * Map a Stripe subscription status to the local schema. Incomplete and
 * paused never grant access — defaulting those (or unknown statuses)
 * to "active" would unlock paid content before payment succeeds.
 */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "paused":
      return "canceled";
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    default:
      return "expired";
  }
}

function unixToDate(value: number | null | undefined): Date | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function stripePeriodEnd(stripeSub: Stripe.Subscription): Date | null {
  const item = stripeSub.items?.data?.[0] as
    | { current_period_end?: number }
    | undefined;
  const unix =
    item?.current_period_end ??
    (stripeSub as unknown as { current_period_end?: number }).current_period_end ??
    stripeSub.cancel_at ??
    null;
  return unixToDate(unix);
}

async function notifyPaidMembershipActivated(subDoc: SubscriptionDocument): Promise<void> {
  const tier = planTierLabel(subDoc.accessLevel);
  const title = `${tier} membership is active`;
  try {
    const recent = await NotificationModel.findOne({
      recipientClerkUserId: subDoc.subscriberClerkUserId,
      category: "renewal",
      title,
      createdAt: { $gte: new Date(Date.now() - 120_000) },
    });
    if (recent) return;

    const creator = await CreatorProfileModel.findOne({
      clerkUserId: subDoc.creatorClerkUserId,
    });
    const remaining = daysRemainingLabel(subDoc.currentPeriodEnd);
    await notifyIfAllowed({
      recipientClerkUserId: subDoc.subscriberClerkUserId,
      category: "renewal",
      title,
      message: creator
        ? `You now have ${tier} access to ${creator.creatorName}.${remaining ? ` ${remaining}.` : ""}`
        : `Your ${tier} membership is active.`,
      link: creator ? `/creators/${creator.creatorSlug}` : "/subscription",
      metadata: {
        event: "subscription.created",
        accessLevel: subDoc.accessLevel,
      },
    });
    await notifyIfAllowed({
      recipientClerkUserId: subDoc.creatorClerkUserId,
      category: "creator",
      title: "New paid subscriber",
      message: `Someone just subscribed to your ${tier} plan.`,
      link: "/creator/subscribers",
      creatorWorkspaceAlertKey: "newSubscriber",
      metadata: {
        event: "subscription.created",
        accessLevel: subDoc.accessLevel,
      },
    });
  } catch (error) {
    console.warn("[stripe:webhook:notify-checkout]", error);
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function subscriptionIdValue(
  value: string | Stripe.Subscription | null | undefined
): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

function expandableId(
  value: string | { id?: string } | null | undefined
): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id ?? "";
}

/**
 * Stripe API 2025+ moved `invoice.subscription` onto
 * `invoice.parent.subscription_details.subscription`. Check every known
 * location so receipts still match a local membership row.
 */
export function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const fromDirect = subscriptionIdValue(
    (invoice as unknown as { subscription?: string | Stripe.Subscription | null })
      .subscription ?? null
  );
  if (fromDirect) return fromDirect;

  const parent = (
    invoice as unknown as {
      parent?: {
        subscription_details?: {
          subscription?: string | Stripe.Subscription | null;
        };
      } | null;
    }
  ).parent;
  const fromParent = subscriptionIdValue(
    parent?.subscription_details?.subscription ?? null
  );
  if (fromParent) return fromParent;

  for (const line of invoice.lines?.data ?? []) {
    const lineAny = line as unknown as {
      subscription?: string | Stripe.Subscription | null;
      parent?: {
        subscription_item_details?: {
          subscription?: string | Stripe.Subscription | null;
        };
      } | null;
    };
    const fromLine = subscriptionIdValue(lineAny.subscription ?? null);
    if (fromLine) return fromLine;
    const fromLineParent = subscriptionIdValue(
      lineAny.parent?.subscription_item_details?.subscription ?? null
    );
    if (fromLineParent) return fromLineParent;
  }

  return "";
}

async function findLocalSubscriptionForInvoice(invoice: Stripe.Invoice) {
  const subId = stripeInvoiceSubscriptionId(invoice);
  if (subId) {
    const bySub = await SubscriptionModel.findOne({ stripeSubscriptionId: subId });
    if (bySub) return bySub;
  }

  const cust = customerId(invoice.customer);
  if (!cust) return null;

  const matches = await SubscriptionModel.find({
    stripeCustomerId: cust,
    stripeSubscriptionId: { $ne: "" },
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const amount = invoice.amount_paid ?? invoice.amount_due ?? 0;
    const byAmount = matches.filter(
      (m) => Math.round(Number(m.priceMonthly) * 100) === amount
    );
    if (byAmount.length === 1) return byAmount[0];
  }
  return null;
}

type SubscriptionMetadata = {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
  planId: string;
  accessLevel: string;
};

function readMetadata(
  metadata: Stripe.Metadata | null | undefined
): Partial<SubscriptionMetadata> {
  if (!metadata) return {};
  return {
    subscriberClerkUserId: asString(metadata.subscriber_clerk_user_id),
    creatorClerkUserId: asString(metadata.creator_clerk_user_id),
    planId: asString(metadata.plan_id),
    accessLevel: asString(metadata.access_level),
  };
}

function isAccessLevel(value: string): value is PlanAccessLevel {
  return value === "free" || value === "basic" || value === "premium";
}

async function resolvePlanFromStripe(
  stripeSub: Stripe.Subscription,
  meta: Partial<SubscriptionMetadata>
) {
  if (meta.planId) {
    const byId = await PlanModel.findById(meta.planId);
    if (byId) return byId;
  }
  const priceId = stripeSub.items.data[0]?.price?.id;
  if (priceId) {
    const byPrice = await PlanModel.findOne({ stripePriceId: priceId });
    if (byPrice) return byPrice;
  }
  return null;
}

/**
 * Upsert a Subscription row from a Stripe Subscription object. Used
 * by `checkout.session.completed`, `customer.subscription.updated`,
 * and `customer.subscription.deleted` so behaviour stays consistent.
 */
export async function upsertSubscriptionFromStripe(
  stripeSub: Stripe.Subscription,
  metadataOverride?: Partial<SubscriptionMetadata>,
  eventCreatedUnix?: number
): Promise<SubscriptionDocument | null> {
  const meta: Partial<SubscriptionMetadata> = {
    ...readMetadata(stripeSub.metadata),
    ...(metadataOverride ?? {}),
  };

  if (!meta.subscriberClerkUserId || !meta.creatorClerkUserId) {
    console.warn(
      "[stripe:webhook] subscription event missing required metadata",
      { stripeSubscriptionId: stripeSub.id }
    );
    return null;
  }

  const plan = await resolvePlanFromStripe(stripeSub, meta);

  if (plan && (!meta.planId || meta.planId !== plan._id.toString())) {
    try {
      const { stampStripeSubscriptionPlanMetadata } = await import(
        "@/lib/stripe/subscription-ops"
      );
      await stampStripeSubscriptionPlanMetadata({
        stripeSubscriptionId: stripeSub.id,
        planId: plan._id.toString(),
        accessLevel: plan.accessLevel,
      });
    } catch (error) {
      console.warn("[stripe:webhook] stamp plan metadata", error);
    }
  }

  const accessLevel: PlanAccessLevel = plan
    ? (plan.accessLevel as PlanAccessLevel)
    : isAccessLevel(meta.accessLevel ?? "")
      ? (meta.accessLevel as PlanAccessLevel)
      : "basic";
  const stripeUnitAmount = stripeSub.items.data[0]?.price?.unit_amount;
  const priceMonthly =
    plan?.priceMonthly ??
    (typeof stripeUnitAmount === "number" ? stripeUnitAmount / 100 : 0);
  const currency =
    plan?.currency ||
    stripeSub.items.data[0]?.price.currency ||
    "usd";

  const status = mapStripeStatus(stripeSub.status);
  const periodEnd = stripePeriodEnd(stripeSub);

  const existing = await SubscriptionModel.findOne({
    subscriberClerkUserId: meta.subscriberClerkUserId,
    creatorClerkUserId: meta.creatorClerkUserId,
  });
  if (
    existing &&
    typeof eventCreatedUnix === "number" &&
    existing.updatedAt &&
    existing.updatedAt.getTime() > eventCreatedUnix * 1000 + 5000
  ) {
    return existing;
  }
  if (
    existing &&
    (status === "canceled" || status === "expired") &&
    existing.accessLevel === "free" &&
    (existing.status === "active" || existing.status === "trialing")
  ) {
    return existing;
  }

  const creator = await CreatorProfileModel.findOne({
    clerkUserId: meta.creatorClerkUserId,
  });

  const update: Record<string, unknown> = {
    status,
    accessLevel,
    billingCycle: "monthly",
    currency,
    priceMonthly,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    canceledAt: status === "canceled" ? new Date() : null,
    stripeCustomerId: customerId(stripeSub.customer),
    stripeSubscriptionId: stripeSub.id,
    creatorProfileId: creator?._id ?? null,
    planId: plan?._id ?? null,
  };

  const doc = await SubscriptionModel.findOneAndUpdate(
    {
      subscriberClerkUserId: meta.subscriberClerkUserId,
      creatorClerkUserId: meta.creatorClerkUserId,
    },
    {
      $set: update,
      $setOnInsert: {
        subscriberClerkUserId: meta.subscriberClerkUserId,
        creatorClerkUserId: meta.creatorClerkUserId,
        startedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (doc) {
    try {
      await recalcCreatorSubscriberCount(doc.creatorClerkUserId);
    } catch (error) {
      console.warn("[stripe:webhook:recalc-count]", error);
    }
  }

  return doc;
}

/**
 * Persist (or update) a Payment ledger row from a Stripe invoice. Uses
 * `stripeInvoiceId` as the natural idempotency key, so handling the
 * same event twice never duplicates rows.
 */
export async function upsertPaymentFromInvoice(
  invoice: Stripe.Invoice,
  status: "succeeded" | "failed"
): Promise<void> {
  if (!invoice.id) return;

  const subId = stripeInvoiceSubscriptionId(invoice);
  const subDoc = await findLocalSubscriptionForInvoice(invoice);

  if (!subDoc) {
    console.warn(
      "[stripe:webhook] invoice received before its subscription is known",
      { invoiceId: invoice.id, subId }
    );
    return;
  }

  const amountCents =
    status === "succeeded"
      ? invoice.amount_paid ?? invoice.amount_due ?? 0
      : invoice.amount_due ?? 0;

  const paidAt = unixToDate(
    invoice.status_transitions?.paid_at ?? invoice.created ?? null
  );

  const paymentIntentId = (() => {
    const intent = (
      invoice as unknown as {
        payment_intent?: string | Stripe.PaymentIntent | null;
      }
    ).payment_intent;
    if (!intent) return "";
    return typeof intent === "string" ? intent : intent.id;
  })();

  const chargeId = (() => {
    const charge = (invoice as unknown as { charge?: string | Stripe.Charge | null })
      .charge;
    if (!charge) return "";
    return typeof charge === "string" ? charge : charge.id;
  })();

  await PaymentModel.findOneAndUpdate(
    { stripeInvoiceId: invoice.id },
    {
      $set: {
        subscriberClerkUserId: subDoc.subscriberClerkUserId,
        creatorClerkUserId: subDoc.creatorClerkUserId,
        subscriptionId: subDoc._id,
        planId: subDoc.planId ?? null,
        amountCents,
        currency: invoice.currency || subDoc.currency || "usd",
        status,
        description: invoice.description ?? "",
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
        stripeInvoiceId: invoice.id,
        receiptUrl: invoice.hosted_invoice_url ?? "",
        paidAt: status === "succeeded" ? paidAt : null,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

/**
 * Top-level dispatcher invoked by `POST /api/webhooks/stripe`. Each
 * branch is independently idempotent (upsert by Stripe id) so Stripe
 * retries are safe.
 */
export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  await connectToMongoDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripe = (await import("@/lib/stripe/client")).getStripeClient();
      const subId = subscriptionIdValue(session.subscription);
      if (!subId) return;
      const stripeSub = await stripe.subscriptions.retrieve(subId);
      const meta = readMetadata(session.metadata);
      const subDoc = await upsertSubscriptionFromStripe(stripeSub, meta);

      if (subDoc) {
        await notifyPaidMembershipActivated(subDoc);
      }
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripe(stripeSub, undefined, event.created);
      return;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const doc = await upsertSubscriptionFromStripe(stripeSub, undefined, event.created);
      if (doc) {
        try {
          await notifyIfAllowed({
            recipientClerkUserId: doc.subscriberClerkUserId,
            category: "renewal",
            title: "Subscription ended",
            message: "Your paid subscription has ended.",
            link: "/subscription",
            metadata: { event: "subscription.canceled" },
          });
          await notifyIfAllowed({
            recipientClerkUserId: doc.creatorClerkUserId,
            category: "creator",
            title: "Subscriber canceled",
            message: `A ${doc.accessLevel} subscriber has canceled their paid subscription.`,
            link: "/creator/subscribers",
            creatorWorkspaceAlertKey: "renewalSummary",
            metadata: { event: "subscription.canceled" },
          });
        } catch (error) {
          console.warn("[stripe:webhook:notify-cancel]", error);
        }
      }
      return;
    }

    case "invoice.upcoming": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = stripeInvoiceSubscriptionId(invoice);
      if (subId) {
        await sendUpcomingInvoiceReminder(subId);
      }
      return;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      await upsertPaymentFromInvoice(invoice, "succeeded");

      const subDoc = await findLocalSubscriptionForInvoice(invoice);
      if (subDoc) {
          const creator = await CreatorProfileModel.findOne({
            clerkUserId: subDoc.creatorClerkUserId,
          });
          const amountCents = invoice.amount_paid ?? invoice.amount_due ?? 0;
          const currency = (invoice.currency || subDoc.currency || "usd").toUpperCase();
          let formatted = `$${(amountCents / 100).toFixed(2)} ${currency}`;
          try {
            formatted = new Intl.NumberFormat(undefined, {
              style: "currency",
              currency,
            }).format(amountCents / 100);
          } catch {
            // Stripe may return non-ISO currency codes; fall back to the
            // pre-formatted string above when Intl rejects them.
          }
          try {
            await notifyIfAllowed({
              recipientClerkUserId: subDoc.subscriberClerkUserId,
              category: "payment",
              title: "Payment received",
              message: creator
                ? `Payment of ${formatted} for ${creator.creatorName} succeeded.`
                : `Payment of ${formatted} succeeded.`,
              link: "/billing",
              metadata: {
                event: "payment.succeeded",
                amountCents,
                currency,
              },
            });
            await notifyIfAllowed({
              recipientClerkUserId: subDoc.creatorClerkUserId,
              category: "creator",
              title: "Payment received",
              message: `${formatted} settled for a ${subDoc.accessLevel} subscriber.`,
              link: "/creator/revenue",
              creatorWorkspaceAlertKey: "weeklyRevenue",
              metadata: {
                event: "payment.succeeded",
                amountCents,
                currency,
              },
            });
          } catch (error) {
            console.warn("[stripe:webhook:notify-paid]", error);
          }
        }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await upsertPaymentFromInvoice(invoice, "failed");
      const subDoc = await findLocalSubscriptionForInvoice(invoice);
      if (subDoc) {
          try {
            await notifyIfAllowed({
              recipientClerkUserId: subDoc.subscriberClerkUserId,
              category: "payment",
              title: "Payment failed",
              message:
                "Your latest subscription payment did not go through. Update your payment method to keep access.",
              link: "/billing",
              metadata: { event: "payment.failed", stripeInvoiceId: invoice.id },
            });
            await notifyIfAllowed({
              recipientClerkUserId: subDoc.creatorClerkUserId,
              category: "creator",
              title: "Subscriber payment failed",
              message: `A ${subDoc.accessLevel} subscriber failed a payment.`,
              link: "/creator/revenue",
              creatorWorkspaceAlertKey: "failedPayment",
              metadata: { event: "payment.failed" },
            });
          } catch (error) {
            console.warn("[stripe:webhook:notify-failed]", error);
          }
        }
      return;
    }

    default:
      // Other events are accepted (200) but not acted on. This keeps
      // the dashboard happy while we incrementally wire more handlers.
      return;
  }
}

/**
 * Replay checkout.session.completed locally when the success page
 * loads before the webhook. Idempotent with the webhook upsert.
 */
export async function confirmCheckoutSessionForUser(input: {
  sessionId: string;
  clerkUserId: string;
}): Promise<{
  ready: boolean;
  accessLevel: PlanAccessLevel | null;
  status: SubscriptionStatus | null;
}> {
  const stripe = (await import("@/lib/stripe/client")).getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId);
  const meta = readMetadata(session.metadata);

  if (
    meta.subscriberClerkUserId &&
    meta.subscriberClerkUserId !== input.clerkUserId
  ) {
    throw new Error("This checkout session belongs to a different account.");
  }

  const complete =
    session.status === "complete" || session.payment_status === "paid";
  if (!complete) {
    return { ready: false, accessLevel: null, status: null };
  }

  const subId = subscriptionIdValue(session.subscription);
  if (!subId) {
    return { ready: false, accessLevel: null, status: null };
  }

  await connectToMongoDB();
  const stripeSub = await stripe.subscriptions.retrieve(subId);
  const doc = await upsertSubscriptionFromStripe(stripeSub, meta);
  if (!doc) {
    return { ready: false, accessLevel: null, status: null };
  }

  const invoiceId =
    expandableId(
      (session as unknown as { invoice?: string | { id?: string } | null }).invoice
    ) ||
    expandableId(
      (stripeSub as unknown as { latest_invoice?: string | { id?: string } | null })
        .latest_invoice
    );
  if (invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const paid =
        invoice.status === "paid" || (invoice.amount_paid ?? 0) > 0;
      await upsertPaymentFromInvoice(invoice, paid ? "succeeded" : "failed");
    } catch (error) {
      console.warn("[stripe:confirm:invoice]", error);
    }
  }

  await notifyPaidMembershipActivated(doc);

  return {
    ready: true,
    accessLevel: doc.accessLevel as PlanAccessLevel,
    status: doc.status as SubscriptionStatus,
  };
}
