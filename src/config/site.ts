/**
 * Centralised site configuration.
 * Used by root layout for metadata, Open Graph, and branding.
 */

function appUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export const siteConfig = {
  name: "Advanced Subscription & Membership Platform",
  shortName: "ASMP",
  title: "Advanced Subscription & Membership Platform",
  description:
    "The all-in-one platform for digital creators, educators, and content businesses to sell paid content, manage subscription plans, control member access, and grow recurring revenue.",
  url: appUrl(),
  supportEmail: "support@asmp.app",
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
};

export type SiteConfig = typeof siteConfig;
