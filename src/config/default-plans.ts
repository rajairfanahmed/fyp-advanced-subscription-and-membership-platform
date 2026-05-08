import type { PlanAccessLevel } from "@/types/plan";

export type DefaultCreatorPlan = {
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  accessLevel: PlanAccessLevel;
  features: string[];
  sortOrder: number;
};

/**
 * Seed plans created automatically the first time a creator opens
 * /creator/plans (or any consumer of `ensureDefaultPlansForCreator`).
 *
 * These match the platform-wide tiers used elsewhere in the UI:
 *  - Free    : Public previews only.
 *  - Basic   : Paid library, articles, downloadable resources.
 *  - Premium : Full library, templates, private resources.
 */
export const DEFAULT_CREATOR_PLANS: DefaultCreatorPlan[] = [
  {
    name: "Free",
    slug: "free",
    description: "Public previews and starter content.",
    priceMonthly: 0,
    accessLevel: "free",
    features: [
      "Free articles and video previews.",
      "Up to 5 file downloads per creator each month.",
      "Standard creator updates.",
    ],
    sortOrder: 0,
  },
  {
    name: "Basic",
    slug: "basic",
    description: "Paid videos, articles, and downloadable resources.",
    priceMonthly: 19,
    accessLevel: "basic",
    features: [
      "Free + Basic-tier videos and articles.",
      "Up to 30 file downloads per creator each month.",
      "PDF, ZIP, and RAR downloads.",
    ],
    sortOrder: 1,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "Full library, templates, and private resources.",
    priceMonthly: 49,
    accessLevel: "premium",
    features: [
      "Every tier of content from the creator.",
      "Unlimited file downloads.",
      "Priority support and templates.",
    ],
    sortOrder: 2,
  },
];
