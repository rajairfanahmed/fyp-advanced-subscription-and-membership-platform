/**
 * Builds docs/FYP-Panel-Defense.pptx from code-verified slide facts + images.
 * Run: node build-pptx.js
 */
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..", "..");
const ASSETS = path.join(ROOT, "presentation-assets");
const OUT = path.join(ROOT, "FYP-Panel-Defense.pptx");

const C = {
  teal: "0D9488",
  mint: "2DD4BF",
  dark: "0F172A",
  slate: "334155",
  muted: "64748B",
  bg: "F8FAFC",
  white: "FFFFFF",
  card: "F1F5F9",
  danger: "B91C1C",
  ok: "047857",
  line: "E2E8F0",
};

function img(name) {
  return path.join(ASSETS, name);
}

function footer(slide, n, total) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 7.22, w: 13.333, h: 0.28, fill: { color: C.dark },
  });
  slide.addText("Advanced Subscription & Membership Platform  ·  FYP Panel Defense", {
    x: 0.3, y: 7.22, w: 10.2, h: 0.28,
    fontSize: 10, color: C.mint, fontFace: "Calibri", valign: "middle",
  });
  slide.addText(`${n} / ${total}`, {
    x: 11.2, y: 7.22, w: 1.85, h: 0.28,
    fontSize: 10, color: C.white, fontFace: "Calibri", align: "right", valign: "middle",
  });
}

function titleBar(slide, title, kicker) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.teal },
  });
  if (kicker) {
    slide.addText(kicker, {
      x: 0.4, y: 0.18, w: 12.5, h: 0.28,
      fontSize: 11, color: C.teal, fontFace: "Calibri", bold: true,
    });
  }
  slide.addText(title, {
    x: 0.4, y: kicker ? 0.4 : 0.22, w: 12.5, h: 0.46,
    fontSize: 26, color: C.dark, fontFace: "Calibri", bold: true,
  });
}

function bullets(slide, items, opts = {}) {
  const y = opts.y ?? 1.05;
  const x = opts.x ?? 0.4;
  const w = opts.w ?? 12.5;
  slide.addText(
    items.map((t) => ({
      text: t,
      options: { bullet: true, breakLine: true },
    })),
    {
      x, y, w, h: opts.h ?? 5.8,
      fontSize: opts.fontSize ?? 16,
      color: C.slate,
      fontFace: "Calibri",
      paraSpaceAfter: 8,
      valign: "top",
    }
  );
}

const pres = new PptxGenJS();
pres.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pres.layout = "WIDE";
pres.author = "Raja Irfan Ahmed";
pres.title = "Advanced Subscription & Membership Platform — FYP Panel Defense";
pres.subject = "Code-verified slide deck for live demo";

const TOTAL = 32;

function add(n) {
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  return slide;
}

// ── 1 Title ──────────────────────────────────────────────
{
  const s = add(1);
  s.addImage({ path: img("slide-title-hero.png"), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 7.4, h: 7.5, fill: { color: C.dark, transparency: 18 },
  });
  s.addImage({ path: img("asmp-favicon.png"), x: 0.5, y: 0.45, w: 0.42, h: 0.42 });
  s.addText("FINAL YEAR PROJECT  ·  PANEL DEFENSE", {
    x: 1.05, y: 0.5, w: 6, h: 0.32,
    fontSize: 12, color: C.mint, fontFace: "Calibri", bold: true,
  });
  s.addText("Advanced Subscription &\nMembership Platform", {
    x: 0.5, y: 1.7, w: 6.6, h: 1.8,
    fontSize: 32, color: C.white, fontFace: "Calibri", bold: true,
  });
  s.addText("Per-creator digital memberships with Clerk, PostgreSQL, Stripe Checkout, and Cloudflare R2.", {
    x: 0.5, y: 3.7, w: 6.4, h: 0.8,
    fontSize: 16, color: "E2E8F0", fontFace: "Calibri",
  });
  s.addText("Raja Irfan Ahmed", {
    x: 0.5, y: 5.9, w: 6, h: 0.32,
    fontSize: 16, color: C.white, fontFace: "Calibri", bold: true,
  });
  s.addText("Live demo: localhost:3000", {
    x: 0.5, y: 6.25, w: 6, h: 0.28,
    fontSize: 13, color: C.mint, fontFace: "Calibri",
  });
  s.addNotes("Name the stack once. Do not call it a marketplace or a Connect payout product. Do not say Nexora.");
}

// ── 2 Idea ───────────────────────────────────────────────
{
  const s = add(2);
  titleBar(s, "What the platform is", "SLIDE 2  ·  PROBLEM & IDEA");
  bullets(s, [
    "Creators publish video, articles, and files (PDF / ZIP / RAR).",
    "Subscribers follow a creator for free, or pay that creator for Basic or Premium.",
    "Access is per (subscriber, creator) pair — not one site-wide plan.",
    "Recurring billing is monthly Stripe Checkout on the platform Stripe account.",
  ], { y: 1.1, h: 3.2 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.4, y: 4.5, w: 12.5, h: 2.4, fill: { color: "FEF2F2" }, rectRadius: 0.08,
  });
  s.addText("Do not claim on the panel", {
    x: 0.6, y: 4.62, w: 12, h: 0.32,
    fontSize: 14, color: C.danger, fontFace: "Calibri", bold: true,
  });
  s.addText("Creators do not get Stripe Connect payouts. Checkout does not split funds. platform_fee_bps is stored on settings (default 10000) but is not used to take a Connect commission.", {
    x: 0.6, y: 5.0, w: 12.1, h: 1.6,
    fontSize: 15, color: C.slate, fontFace: "Calibri",
  });
  footer(s, 2, TOTAL);
}

// ── 3 Objectives ─────────────────────────────────────────
{
  const s = add(3);
  titleBar(s, "Objectives → what you can demo", "SLIDE 3  ·  ASSIGNED FEATURES");
  s.addImage({
    path: img("project-objectives.jpeg"),
    x: 0.35, y: 1.05, w: 5.3, h: 5.85,
  });
  const rows = [
    [
      { text: "#", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      { text: "Objective", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      { text: "Live proof", options: { fill: { color: C.dark }, color: C.white, bold: true } },
    ],
    ["1", "Multi-tier + recurring pay", "Basic $19 / Premium $49 · Stripe Checkout"],
    ["2", "Access by subscription", "Free plays; Basic 403 until Checkout"],
    ["3", "Renewal reminders", "invoice.upcoming + cron (default 7 days)"],
    ["4", "Analytics dashboards", "Creator + admin + daily rollup"],
  ];
  s.addTable(rows, {
    x: 5.85, y: 1.15, w: 7.1, h: 4.4,
    colW: [0.5, 2.5, 4.1],
    fontFace: "Calibri",
    fontSize: 12,
    color: C.slate,
    border: [{ pt: 0.5, color: C.line }],
    align: "left",
    valign: "middle",
  });
  footer(s, 3, TOTAL);
}

// ── 4 Scope ──────────────────────────────────────────────
{
  const s = add(4);
  titleBar(s, "Scope — honest", "SLIDE 4");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.4, y: 1.1, w: 6.1, h: 5.8, fill: { color: "ECFDF5" }, rectRadius: 0.08,
  });
  s.addText("Built", {
    x: 0.6, y: 1.25, w: 5.7, h: 0.36,
    fontSize: 18, color: C.ok, fontFace: "Calibri", bold: true,
  });
  bullets(s, [
    "Next.js 15.3 App Router, React 19, TypeScript",
    "Clerk v7 (email/password, Google, reset, verify)",
    "PostgreSQL (pg pool, max 10 connections)",
    "Stripe Checkout + Portal + signed webhooks",
    "Cloudflare R2 PutObject (server-side, no client presign)",
    "59 App Router API route handlers",
  ], { x: 0.6, y: 1.7, w: 5.7, h: 4.9, fontSize: 15 });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.8, y: 1.1, w: 6.1, h: 5.8, fill: { color: "FEF2F2" }, rectRadius: 0.08,
  });
  s.addText("Do not claim", {
    x: 7.0, y: 1.25, w: 5.7, h: 0.36,
    fontSize: 18, color: C.danger, fontFace: "Calibri", bold: true,
  });
  bullets(s, [
    "Postgres Row Level Security (RLS) — not in schema.sql",
    "Stripe Connect / connected accounts",
    "MongoDB as the runtime database",
    "Redis / clustered rate limiting",
    "Admin as a public signup role",
  ], { x: 7.0, y: 1.7, w: 5.7, h: 4.9, fontSize: 15 });
  footer(s, 4, TOTAL);
}

// ── 5 Stack ──────────────────────────────────────────────
{
  const s = add(5);
  titleBar(s, "Stack as shipped (package.json 1.0.0)", "SLIDE 5");
  s.addTable(
    [
      [
        { text: "Layer", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Package / system", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      ],
      ["App", "next ^15.3.1 · react ^19.1.0"],
      ["Auth", "@clerk/nextjs ^7.3.0"],
      ["Data", "pg ^8.11.5 · DB AdvancedSubscription_MembershipPlatform"],
      ["Billing", "stripe ^22.1.1"],
      ["Storage", "@aws-sdk/client-s3 → Cloudflare R2 region auto"],
      ["UI", "Tailwind CSS 4 · Framer Motion · Lenis"],
      ["Folder name", "src/lib/mongodb/ is a PostgreSQL adapter, not Mongo"],
    ],
    {
      x: 0.4, y: 1.1, w: 12.5, colW: [2.2, 10.3],
      fontFace: "Calibri", fontSize: 14, color: C.slate,
      border: [{ pt: 0.5, color: C.line }], valign: "middle",
    }
  );
  s.addText("Env the panel may ask: DATABASE_URL · ADMIN_EMAILS · STRIPE_* · CLOUDFLARE_R2_* · CRON_SECRET · NEXT_PUBLIC_APP_URL", {
    x: 0.4, y: 6.55, w: 12.5, h: 0.45,
    fontSize: 12, color: C.muted, fontFace: "Calibri",
  });
  footer(s, 5, TOTAL);
}

// ── 6 Architecture ───────────────────────────────────────
{
  const s = add(6);
  titleBar(s, "Request path", "SLIDE 6  ·  ARCHITECTURE");
  s.addImage({ path: img("slide-architecture.png"), x: 0.35, y: 0.95, w: 12.6, h: 6.05 });
  s.addNotes("Middleware is the perimeter. Route handlers still re-check role, ownership, and ADMIN_EMAILS.");
  footer(s, 6, TOTAL);
}

// ── 7 Deployment (existing UML) ──────────────────────────
{
  const s = add(7);
  titleBar(s, "Deployment (report figure 4.10)", "SLIDE 7  ·  IMAGE");
  s.addImage({ path: img("4.10_Deployment_Diagram.png"), x: 1.4, y: 0.95, w: 10.5, h: 6.05 });
  footer(s, 7, TOTAL);
}

// ── 8 Four roles ─────────────────────────────────────────
{
  const s = add(8);
  titleBar(s, "Identity model — four roles", "SLIDE 8");
  s.addImage({ path: img("slide-four-roles.png"), x: 0.3, y: 0.95, w: 12.7, h: 5.0 });
  s.addText("Clerk publicMetadata.role is only subscriber | creator. Admin is an overlay: same login, email listed in ADMIN_EMAILS. Set-role never accepts “admin”.", {
    x: 0.4, y: 6.05, w: 12.5, h: 0.9,
    fontSize: 14, color: C.slate, fontFace: "Calibri",
  });
  footer(s, 8, TOTAL);
}

// ── 9 Use case ───────────────────────────────────────────
{
  const s = add(9);
  titleBar(s, "Use cases by role (report figure 4.1)", "SLIDE 9  ·  IMAGE");
  s.addImage({ path: img("4.1_Main_Use_Case_Diagram.png"), x: 2.4, y: 0.92, w: 8.5, h: 6.1 });
  footer(s, 9, TOTAL);
}

// ── 10 Guest ─────────────────────────────────────────────
{
  const s = add(10);
  titleBar(s, "Role 1 — Guest", "SLIDE 10");
  bullets(s, [
    "Public pages: /  /pricing  /about  /support  /contact  /creators  /login  /sign-up",
    "Public APIs are an explicit allowlist (never /api/auth/(.*) as a glob).",
    "Other /api/* without a session → 401 JSON { error, code: UNAUTHENTICATED }",
    "Session pages → /login?redirect_url=…",
    "Unknown URLs are not forced to login — they 404 on purpose.",
  ], { y: 1.05, h: 3.6, fontSize: 16 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.4, y: 4.8, w: 12.5, h: 2.1, fill: { color: C.card }, rectRadius: 0.08,
  });
  s.addText("Demo", {
    x: 0.6, y: 4.95, w: 12, h: 0.3,
    fontSize: 13, color: C.teal, fontFace: "Calibri", bold: true,
  });
  s.addText("Open /creators signed out. Click a paid item → login. Open /api/checkout in the browser → 401 JSON.", {
    x: 0.6, y: 5.3, w: 12.1, h: 1.3,
    fontSize: 15, color: C.slate, fontFace: "Calibri",
  });
  footer(s, 10, TOTAL);
}

// ── 11 Subscriber ────────────────────────────────────────
{
  const s = add(11);
  titleBar(s, "Role 2 — Subscriber  →  /library", "SLIDE 11");
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.4, y: 1.05, w: 6.2, h: 5.85, fill: { color: "ECFDF5" }, rectRadius: 0.08,
  });
  s.addText("Can", { x: 0.6, y: 1.18, w: 5.8, h: 0.32, fontSize: 16, color: C.ok, bold: true, fontFace: "Calibri" });
  bullets(s, [
    "Follow a creator free (POST /api/subscriptions) — no card",
    "Pay Basic/Premium via POST /api/checkout",
    "Watch GET /api/content/[id]/playback (Range stream)",
    "Download POST /api/content/[id]/download as attachment",
    "Billing Portal, notifications, account",
  ], { x: 0.55, y: 1.55, w: 5.9, h: 5.1, fontSize: 14 });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.85, y: 1.05, w: 6.1, h: 5.85, fill: { color: "FEF2F2" }, rectRadius: 0.08,
  });
  s.addText("Cannot / access rules", { x: 7.05, y: 1.18, w: 5.7, h: 0.32, fontSize: 16, color: C.danger, bold: true, fontFace: "Calibri" });
  bullets(s, [
    "Cannot upload (/api/storage/upload is creator/admin)",
    "Cannot open /creator (middleware redirect /library)",
    "Creators and admin overlay cannot use subscriber Checkout",
    "Grants access: active, trialing, past_due",
    "Denies: canceled, expired; paid period end in the past (+2 min skew)",
  ], { x: 7.0, y: 1.55, w: 5.75, h: 5.1, fontSize: 14 });
  footer(s, 11, TOTAL);
}

// ── 12 Creator ───────────────────────────────────────────
{
  const s = add(12);
  titleBar(s, "Role 3 — Creator  →  /creator", "SLIDE 12");
  bullets(s, [
    "Workspace: overview, content, plans, subscribers, revenue, analytics, settings.",
    "Ownership: queries include creatorClerkUserId of the signed-in creator.",
    "Default plans: Free / Basic $19 / Premium $49. Paid price $1–$9,999.",
    "Server syncs Stripe Product/Price. Missing stripePriceId → Checkout not ready.",
    "Upload: raw body → POST /api/storage/upload → PutObject. Caps 8 MB / 500 MB / 200 MB.",
    "Middleware blocks /library, /subscription, /billing for creators (admins exempt).",
  ], { y: 1.1, h: 4.4, fontSize: 16 });
  s.addText("Demo: publish a Basic video → another user sees it locked until Basic Checkout succeeds.", {
    x: 0.4, y: 5.8, w: 12.5, h: 1.05,
    fontSize: 15, color: C.slate, fontFace: "Calibri",
  });
  footer(s, 12, TOTAL);
}

// ── 13 Admin ─────────────────────────────────────────────
{
  const s = add(13);
  titleBar(s, "Role 4 — Admin overlay (ADMIN_EMAILS)", "SLIDE 13");
  s.addImage({ path: img("slide-admin-gating.png"), x: 0.3, y: 0.95, w: 7.3, h: 5.95 });
  bullets(s, [
    "Comma-separated env emails, trimmed, lowercased. Not NEXT_PUBLIC_.",
    "Three gates: middleware, admin layout requireAdminContext, every /api/admin/*.",
    "GET /api/auth/check-admin is session-only for the caller — not an email oracle.",
    "Mutations: 60 / 15 min. Typed phrases e.g. CANCEL NOW.",
    "Stripe cancel fail-closed: local row unchanged if Stripe fails (502).",
  ], { x: 7.7, y: 1.1, w: 5.3, h: 5.6, fontSize: 14 });
  footer(s, 13, TOTAL);
}

// ── 14 Middleware ────────────────────────────────────────
{
  const s = add(14);
  titleBar(s, "src/middleware.ts perimeter", "SLIDE 14");
  bullets(s, [
    "Contact POST: 5 / 15 min per IP. Throttle API POST: 40 / 15 min.",
    "Maintenance: public → /maintenance or API 503; admins still enter.",
    "Public matcher first. Then session. Then role.",
    "/admin or /api/admin/* without ADMIN_EMAILS → 403 or redirect.",
    "/creator without creator role → /library.",
    "Creator hitting /library /subscription /billing → /creator.",
    "Already signed in on /login → admin /admin, creator /creator, else /library.",
  ], { y: 1.1, fontSize: 16 });
  footer(s, 14, TOTAL);
}

// ── 15 Admin gating Q&A ──────────────────────────────────
{
  const s = add(15);
  titleBar(s, "Panel Q&A — admin & RLS", "SLIDE 15  ·  CRITICAL");
  const qa = [
    ["Is admin still ADMIN_EMAILS?", "Yes. It is the only admin gate. Signup cannot choose admin."],
    ["Was the email oracle removed?", "Yes. check-admin ignores ?email= and only reads the session user."],
    ["Is admin “session-only”?", "Identity is Clerk session. Authorization is still ADMIN_EMAILS on the server."],
    ["Postgres RLS?", "No. Isolation is application filters + unique indexes, not CREATE POLICY."],
  ];
  s.addTable(
    [
      [
        { text: "Question", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Exact answer", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      ],
      ...qa,
    ],
    {
      x: 0.4, y: 1.1, w: 12.5, colW: [4.2, 8.3],
      fontFace: "Calibri", fontSize: 14, color: C.slate,
      border: [{ pt: 0.5, color: C.line }], valign: "middle",
    }
  );
  footer(s, 15, TOTAL);
}

// ── 16 Rate limits ───────────────────────────────────────
{
  const s = add(16);
  titleBar(s, "Sliding-window rate limits (in-memory)", "SLIDE 16");
  s.addTable(
    [
      [
        { text: "Key", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Limit", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Window", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      ],
      ["auth:login:{ip}", "8", "15 min"],
      ["auth:register:{ip}", "5", "15 min"],
      ["auth:forgot-password:{ip}", "3", "15 min"],
      ["contact:{ip}", "5", "15 min"],
      ["admin-mutate:{user}:{ip}", "60", "15 min"],
      ["download:{user} / {ip}", "20 / 40", "15 min"],
      ["view:{ip}:{contentId}", "8", "60 min"],
    ],
    {
      x: 0.4, y: 1.05, w: 12.5, colW: [6.5, 2.8, 3.2],
      fontFace: "Calibri", fontSize: 14, color: C.slate,
      border: [{ pt: 0.5, color: C.line }], valign: "middle",
    }
  );
  s.addText("Honest limit: process-local Map. Restart resets counters. Not Redis.", {
    x: 0.4, y: 6.5, w: 12.5, h: 0.4,
    fontSize: 14, color: C.muted, fontFace: "Calibri",
  });
  footer(s, 16, TOTAL);
}

// ── 17 Tiers ─────────────────────────────────────────────
{
  const s = add(17);
  titleBar(s, "One membership per creator", "SLIDE 17");
  s.addImage({ path: img("slide-tiers.png"), x: 0.25, y: 0.92, w: 12.8, h: 5.0 });
  s.addText("Unique (subscriber, creator). Free→paid always opens hosted Checkout. In-place upgrade only if local membership is already a live paid tier.", {
    x: 0.4, y: 6.0, w: 12.5, h: 0.9,
    fontSize: 14, color: C.slate, fontFace: "Calibri",
  });
  footer(s, 17, TOTAL);
}

// ── 18 Stripe flow image ─────────────────────────────────
{
  const s = add(18);
  titleBar(s, "Recurring payments — Checkout", "SLIDE 18");
  s.addImage({ path: img("slide-stripe-flow.png"), x: 0.25, y: 0.95, w: 12.8, h: 6.0 });
  footer(s, 18, TOTAL);
}

// ── 19 Sequence UML ──────────────────────────────────────
{
  const s = add(19);
  titleBar(s, "Paid checkout sequence (report figure 4.6)", "SLIDE 19  ·  IMAGE");
  s.addImage({ path: img("4.6_Sequence_Diagram.png"), x: 0.55, y: 0.95, w: 12.2, h: 6.05 });
  footer(s, 19, TOTAL);
}

// ── 20 Webhooks ──────────────────────────────────────────
{
  const s = add(20);
  titleBar(s, "Stripe webhooks — exact events", "SLIDE 20");
  bullets(s, [
    "POST /api/webhooks/stripe — raw body + stripe-signature + constructEvent.",
    "Handled: checkout.session.completed · subscription created/updated/deleted · invoice.upcoming · invoice.paid / payment_succeeded · invoice.payment_failed.",
    "Unknown types: HTTP 200 no-op.",
    "Idempotency: stripe_webhook_events.event_id PK. Duplicate → { duplicate: true }.",
    "Success-page race: confirmCheckoutSessionForUser rejects another user’s session id.",
    "No Stripe Connect. Charges hit the platform account.",
  ], { y: 1.1, fontSize: 16 });
  footer(s, 20, TOTAL);
}

// ── 21 Access ────────────────────────────────────────────
{
  const s = add(21);
  titleBar(s, "Application-level access (not RLS)", "SLIDE 21");
  bullets(s, [
    "Published only. Admin email grants. Suspended viewer/creator denied.",
    "Owner or requiredPlan=free grants. Else live sub for THAT creator + rank.",
    "JSON redacts videoUrl, videoKey, fileUrl, fileKey. Bytes only via playback/download routes.",
    "Creator writes: findOne({ _id, creatorClerkUserId: context.clerkUserId }).",
    "R2 keys must contain that user’s Clerk id (storageKeyBelongsToUser).",
    "Same DB role for all queries — the app attaches the filters.",
  ], { y: 1.1, fontSize: 16 });
  footer(s, 21, TOTAL);
}

// ── 22 R2 ────────────────────────────────────────────────
{
  const s = add(22);
  titleBar(s, "Cloudflare R2 — no client presign", "SLIDE 22");
  s.addImage({ path: img("slide-r2-storage.png"), x: 0.25, y: 0.95, w: 12.8, h: 6.0 });
  footer(s, 22, TOTAL);
}

// ── 23 Quota ─────────────────────────────────────────────
{
  const s = add(23);
  titleBar(s, "Download quota — SELECT … FOR UPDATE", "SLIDE 23");
  s.addImage({ path: img("slide-quota-flow.png"), x: 0.25, y: 0.95, w: 12.8, h: 6.0 });
  footer(s, 23, TOTAL);
}

// ── 24 Cron ──────────────────────────────────────────────
{
  const s = add(24);
  titleBar(s, "Renewal reminders & analytics cron", "SLIDE 24  ·  OBJECTIVES 3–4");
  bullets(s, [
    "invoice.upcoming → in-app renewal notification.",
    "/api/cron/renewal-reminders — Bearer CRON_SECRET (or ?secret= in non-production only).",
    "Lead days from platform_settings, clamped 1–30, default 7. Skips free and cancelAtPeriodEnd.",
    "/api/cron/analytics/daily-rollup writes per-creator snapshots (subs, revenue, views, downloads, churn).",
    "If CRON_SECRET is unset, cron routes return 401.",
  ], { y: 1.1, fontSize: 16 });
  footer(s, 24, TOTAL);
}

// ── 25 Schema ────────────────────────────────────────────
{
  const s = add(25);
  titleBar(s, "PostgreSQL — 19 tables, no RLS", "SLIDE 25");
  s.addText("user_profiles · creator_profiles · subscriber_profiles · plans · plan_features · content · subscriptions · payments · notifications · analytics · contacts · platform_settings · stripe_webhook_events · admin_audit_events · plus workspace/preference helpers", {
    x: 0.4, y: 1.1, w: 12.5, h: 1.4,
    fontSize: 15, color: C.slate, fontFace: "Calibri",
  });
  bullets(s, [
    "user_role enum: subscriber | creator — there is no admin enum.",
    "access_level: free | basic | premium. billing_cycle: monthly only.",
    "UNIQUE membership pair + idx_subscriptions_clerk_pair.",
    "Webhook event_id primary key. Partial unique Stripe invoice id.",
    "Pool: DATABASE_URL, max 10 connections.",
  ], { y: 2.6, h: 4.2, fontSize: 16 });
  footer(s, 25, TOTAL);
}

// ── 26 DFD ───────────────────────────────────────────────
{
  const s = add(26);
  titleBar(s, "Data flow (report figure 4.3)", "SLIDE 26  ·  IMAGE");
  s.addImage({ path: img("4.3_DFD_Level_0.png"), x: 1.6, y: 0.95, w: 10.1, h: 6.05 });
  footer(s, 26, TOTAL);
}

// ── 27 Component ─────────────────────────────────────────
{
  const s = add(27);
  titleBar(s, "Components (report figure 4.9)", "SLIDE 27  ·  IMAGE");
  s.addImage({ path: img("4.9_Component_Level_Design.png"), x: 0.55, y: 0.95, w: 12.2, h: 6.05 });
  footer(s, 27, TOTAL);
}

// ── 28 Security ──────────────────────────────────────────
{
  const s = add(28);
  titleBar(s, "Security — say only this", "SLIDE 28");
  bullets(s, [
    "Clerk session on protected APIs; guests get 401 JSON.",
    "Admin = ADMIN_EMAILS; check-admin is not an email oracle.",
    "Set-role cannot write admin.",
    "Process-local rate limits on auth, contact, download, views, admin writes.",
    "Stripe webhook signature + claimed event ids. Cron bearer secret.",
    "Ownership filters + R2 key prefix. Media URLs stripped from JSON.",
    "Suspended accounts blocked on checkout, download, upload, playback.",
    "Admin Stripe actions fail closed. We do not store card numbers.",
  ], { y: 1.05, fontSize: 16 });
  footer(s, 28, TOTAL);
}

// ── 29 Demo script ───────────────────────────────────────
{
  const s = add(29);
  titleBar(s, "Live demo order", "SLIDE 29");
  s.addTable(
    [
      [
        { text: "#", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Role", options: { fill: { color: C.dark }, color: C.white, bold: true } },
        { text: "Action → expected", options: { fill: { color: C.dark }, color: C.white, bold: true } },
      ],
      ["1", "Guest", "/creators → published creators only"],
      ["2", "Guest", "Paid item → login?redirect_url="],
      ["3", "Subscriber", "Follow → Free, no Stripe"],
      ["4", "Subscriber", "Basic Subscribe → checkout.stripe.com"],
      ["5", "Subscriber", "Test card 4242 → Basic unlocks"],
      ["6", "Subscriber", "Play / download → gated stream + quota headers"],
      ["7", "Creator", "Own plans/content only"],
      ["8", "Admin", "/admin with allowlisted email"],
      ["9", "Non-admin", "/admin redirected away"],
      ["10", "Admin", "Maintenance / +7d / Period end / Cancel now"],
    ],
    {
      x: 0.4, y: 1.0, w: 12.5, colW: [0.6, 2.1, 9.8],
      fontFace: "Calibri", fontSize: 13, color: C.slate,
      border: [{ pt: 0.5, color: C.line }], valign: "middle",
    }
  );
  footer(s, 29, TOTAL);
}

// ── 30 Activity ──────────────────────────────────────────
{
  const s = add(30);
  titleBar(s, "Activity (report figure 4.2)", "SLIDE 30  ·  IMAGE");
  s.addImage({ path: img("4.2_Activity_Diagram.png"), x: 2.15, y: 0.95, w: 9.0, h: 6.05 });
  footer(s, 30, TOTAL);
}

// ── 31 Limitations ───────────────────────────────────────
{
  const s = add(31);
  titleBar(s, "Known boundaries", "SLIDE 31");
  bullets(s, [
    "Rate limits are per process, not Redis.",
    "Folder name mongodb is historical; runtime is PostgreSQL.",
    "No Stripe Connect — creators do not receive automatic payouts.",
    "No Postgres RLS.",
    "Anyone who can edit server env can change ADMIN_EMAILS.",
    "Keep stripe listen running so webhooks save paid memberships.",
  ], { y: 1.1, fontSize: 17 });
  footer(s, 31, TOTAL);
}

// ── 32 Close ─────────────────────────────────────────────
{
  const s = add(32);
  s.background = { color: C.dark };
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.mint },
  });
  s.addText("Thank you", {
    x: 0.6, y: 2.2, w: 12, h: 0.8,
    fontSize: 40, color: C.white, fontFace: "Calibri", bold: true,
  });
  s.addText("Questions — demo accounts, Stripe test card 4242, and ADMIN_EMAILS.", {
    x: 0.6, y: 3.15, w: 12, h: 0.5,
    fontSize: 18, color: C.mint, fontFace: "Calibri",
  });
  s.addText("Source facts: docs/fyp-panel-defense-slides.md\nManual test list: docs/manual-testing-checklist.md", {
    x: 0.6, y: 4.2, w: 12, h: 1.0,
    fontSize: 14, color: "94A3B8", fontFace: "Calibri",
  });
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log("Wrote", OUT);
});
