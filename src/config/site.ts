/**
 * Centralised site configuration.
 * Used by root layout for metadata, Open Graph, and branding.
 */

export const siteConfig = {
  name: "Advanced Subscription & Membership Platform",
  shortName: "ASMP",
  title: "Advanced Subscription & Membership Platform",
  description:
    "The all-in-one platform for digital creators, educators, and content businesses to sell paid content, manage subscription plans, control member access, and grow recurring revenue.",
  url: "http://localhost:3000",
  locale: "en_US",
  keywords: [
    "subscription platform",
    "membership platform",
    "SaaS",
    "digital creators",
    "content monetization",
    "recurring payments",
    "member access",
  ],
  creator: "Advanced Subscription & Membership Platform",
} as const;

export type SiteConfig = typeof siteConfig;
