import { ensureCurrentUserProfile } from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  PaymentModel,
  type CreatorProfileDocument,
  type PaymentDocument,
} from "@/lib/mongodb/models";
import type { PaymentResponse, PaymentStatus } from "@/types/payment";

async function loadCreatorProfile(
  doc: PaymentDocument
): Promise<CreatorProfileDocument | null> {
  return CreatorProfileModel.findOne({ clerkUserId: doc.creatorClerkUserId });
}

export async function serializePayment(
  doc: PaymentDocument,
  creatorProfile?: CreatorProfileDocument | null
): Promise<PaymentResponse> {
  const creator = creatorProfile === undefined ? await loadCreatorProfile(doc) : creatorProfile;

  return {
    id: doc._id.toString(),
    subscriberClerkUserId: doc.subscriberClerkUserId,
    creatorClerkUserId: doc.creatorClerkUserId,
    creatorName: creator?.creatorName ?? "Advanced Subscription & Membership Platform Creator",
    creatorSlug: creator?.creatorSlug ?? "",
    subscriptionId: doc.subscriptionId ? doc.subscriptionId.toString() : null,
    planId: doc.planId ? doc.planId.toString() : null,
    amountCents: doc.amountCents,
    currency: doc.currency,
    status: doc.status as PaymentStatus,
    description: doc.description ?? "",
    stripePaymentIntentId: doc.stripePaymentIntentId ?? "",
    stripeChargeId: doc.stripeChargeId ?? "",
    stripeInvoiceId: doc.stripeInvoiceId ?? "",
    receiptUrl: doc.receiptUrl ?? "",
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * List the current subscriber's payment history (newest first).
 * Returns an empty array until the Stripe webhook layer starts
 * writing into the Payment collection.
 */
export async function listCurrentUserPayments(): Promise<PaymentResponse[]> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return [];

  const docs = await PaymentModel.find({
    subscriberClerkUserId: synced.user.id,
  }).sort({ paidAt: -1, createdAt: -1 });

  return Promise.all(docs.map((doc) => serializePayment(doc)));
}
