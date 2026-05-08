export type PaymentStatus = "succeeded" | "pending" | "failed" | "refunded";

export type PaymentResponse = {
  id: string;
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
  creatorName: string;
  creatorSlug: string;
  subscriptionId: string | null;
  planId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  stripeInvoiceId: string;
  receiptUrl: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};
