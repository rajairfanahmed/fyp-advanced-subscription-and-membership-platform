export type PlanAccessLevel = "free" | "basic" | "premium";
export type PlanBillingCycle = "monthly";

export type PlanResponse = {
  id: string;
  creatorClerkUserId: string;
  creatorProfileId: string | null;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  currency: string;
  billingCycle: PlanBillingCycle;
  accessLevel: PlanAccessLevel;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  stripePriceId: string;
  stripeProductId: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanCreateInput = {
  name?: unknown;
  description?: unknown;
  priceMonthly?: unknown;
  accessLevel?: unknown;
  features?: unknown;
  isActive?: unknown;
  stripePriceId?: unknown;
  stripeProductId?: unknown;
};

export type PlanUpdateInput = {
  name?: unknown;
  description?: unknown;
  priceMonthly?: unknown;
  features?: unknown;
  isActive?: unknown;
  stripePriceId?: unknown;
  stripeProductId?: unknown;
};
