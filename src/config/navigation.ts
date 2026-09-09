/**
 * Navigation configuration.
 * Centralised link definitions for header and footer.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterLinkGroup {
  title: string;
  links: NavLink[];
}

/* ── Header Navigation ───────────────────────────────────── */

export const mainNavLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Content", href: "/content-preview" },
  { label: "About", href: "/about" },
  { label: "Support", href: "/support" },
];

export const authLinks = {
  login: { label: "Log In", href: "/login" },
  signup: { label: "Start Free", href: "/sign-up" },
} as const;

/* ── Footer Navigation ───────────────────────────────────── */

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Content Library", href: "/content-preview" },
      { label: "Member Dashboard", href: "/library" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Support", href: "/support" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];
