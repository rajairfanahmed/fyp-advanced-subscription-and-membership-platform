# Advanced Subscription & Membership Platform

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white" alt="Clerk" />
  <img src="https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/Cloudflare_R2-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare R2" />
</p>

A full-stack membership platform built as a **Final Year / capstone project**. Creators publish gated video, articles, and files. Subscribers follow a creator at no cost, or pay **that creator** for Basic or Premium access through Stripe Checkout. Administrators oversee users, content, payments, and platform settings.

Membership is **per creator**, not a single site-wide plan. There is **no Stripe Connect** and **no platform commission**. Paid Checkout charges the platform Stripe account; access is stored against each (subscriber, creator) pair.

---

## Overview

| | |
|---|---|
| **Product** | Advanced Subscription & Membership Platform (ASMP) |
| **Author** | [Raja Irfan Ahmed](https://github.com/rajairfanahmed) |
| **Repository** | [fyp-advanced-subscription-and-membership-platform](https://github.com/rajairfanahmed/fyp-advanced-subscription-and-membership-platform) |
| **Runtime** | Next.js 15 App Router, React 19, TypeScript |
| **Auth** | Clerk (email/password, Google, verification, password reset) |
| **Data** | PostgreSQL — 17 tables (`DATABASE_URL`; adapter under `src/lib/mongodb/`) |
| **API** | 50+ Next.js App Router route handlers |
| **Billing** | Stripe Checkout, Customer Portal, signed webhooks |
| **Storage** | Cloudflare R2 (S3 API) for video, covers, and PDF/ZIP/RAR files |
| **Roles** | `subscriber`, `creator`, plus admin via `ADMIN_EMAILS` |

---

## System architecture

```
Browser (subscriber / creator / admin)
        │
        ▼
Next.js 15  ── Clerk middleware (public / role / maintenance gates)
        │
        ├── PostgreSQL   user_profiles, creator_profiles, plans,
        │                subscriptions, content, payments, notifications
        ├── Stripe       Checkout Session, Billing Portal, webhooks
        └── Cloudflare R2   uploads + attachment downloads
```

### How billing actually works

1. A creator publishes a paid plan. The server syncs it to a Stripe Product/Price on the **platform** Stripe account (`stripePriceId` on the plan row).
2. A subscriber clicks Subscribe on that creator. `POST /api/checkout` creates a Checkout Session. Stripe charges the platform account.
3. `POST /api/webhooks/stripe` upserts the local `subscriptions` row. Access is granted only for `active`, `trialing`, and `past_due`. `incomplete` and `paused` do **not** grant access.
4. Paid cancel sets `cancel_at_period_end`. The subscriber keeps access until the period ends.
5. The Billing Portal lets the subscriber manage cards and invoices. There is no connected creator account and no Connect onboarding.

### PostgreSQL schema

Apply `scripts/postgres/schema.sql` to database `AdvancedSubscription_MembershipPlatform`. Core tables:

| Table | Role |
|---|---|
| `user_profiles` | Clerk user, role, `account_status` |
| `creator_profiles` | Public creator page, draft/published |
| `subscriber_profiles` | Notification prefs, display name |
| `plans` | Per-creator Free / Basic / Premium catalog + Stripe IDs |
| `subscriptions` | Unique (subscriber, creator) membership + download quota |
| `content` | Video / article / file, `required_plan`, R2 keys |
| `payments` | Stripe invoice/charge history |
| `notifications` | In-app inbox |
| `platform_settings` | Maintenance mode and admin defaults |

The folder `src/lib/mongodb/` is the data access layer (name kept for stability). At runtime it talks to PostgreSQL through `src/lib/mongodb/pg-adapter.ts` and `src/lib/db/pool.ts`.

---

## Core features by role

### Subscriber

- Sign up, verify email, Google SSO, password reset.
- Browse public creators and previews. Follow a creator for **free** (no card).
- Subscribe to that creator’s Basic or Premium plan via Stripe Checkout.
- Library with tier-gated video, articles, and files.
- Monthly download quota **per creator** (Free 5, Basic 30, Premium unlimited). PDF/ZIP/RAR always **download as a file** — they do not open in the tab.
- Subscription page, Billing Portal, account settings, in-app notifications.
- Creators cannot use subscriber checkout or Follow.

### Creator

- Creator workspace: content, plans, subscribers, revenue, analytics, settings.
- Publish video (upload or external URL), markdown articles, and PDF/ZIP/RAR.
- Assign each item Free, Basic, or Premium. Draft / published / archived.
- Paid plans sync to Stripe. If a price is missing, Checkout shows “Checkout not ready”.
- Cannot subscribe to other creators (by design). Own profile links to **Your plans**.

### Admin (`ADMIN_EMAILS`)

- Overlay role: still a subscriber or creator in Clerk, plus `/admin`.
- Users, creators, subscribers, content, plans, payments, subscriptions, analytics, notifications, settings.
- Suspend / restore accounts (blocks checkout, subscribe, download, uploads).
- Cancel or reactivate a subscription **through Stripe** when a Stripe ID exists (fail-closed).
- Refund / retry payment actions, maintenance mode (public site shows `/maintenance`; admins still enter).

---

## Subscription tiers

Access is compared as **Free (0) < Basic (1) < Premium (2)** on **that creator only**.

| Tier | How you get it | Content | Downloads / creator / 30 days |
|---|---|---|---|
| **Free** | Follow (no card) | That creator’s Free items | 5 |
| **Basic** | Stripe Checkout | Free + Basic | 30 |
| **Premium** | Stripe Checkout | All of that creator’s catalog | Unlimited |

Rules the panel should hear:

- One live membership row per (subscriber, creator). Upgrade replaces the row.
- `past_due` still grants access (Stripe grace).
- Paid cancel keeps access until period end.
- Suspended accounts are rejected on mutating routes.
- File URLs are not handed to the browser; downloads stream with `Content-Disposition: attachment`.

---

## Repository layout

```
src/app/                 App Router pages + API routes
src/components/          UI, cards, dashboards, forms
src/lib/mongodb/         Data access (PostgreSQL adapter)
src/lib/db/              Pool + IDs
src/lib/stripe/          Checkout, portal, webhooks, plan sync
src/lib/storage/         Cloudflare R2
src/lib/auth/            Profile sync, roles, admin gate
src/config/              Tiers, default plans, site
src/middleware.ts        Clerk + maintenance + role fences
scripts/postgres/        schema.sql, check-counts.mjs
docs/                    Reserved for FYP diagrams / report assets
```

---

## Local development setup

### Requirements

- Node.js 20+
- PostgreSQL 14+
- npm
- Stripe CLI (optional, for local webhooks)
- Clerk, Stripe, and Cloudflare R2 accounts (test mode is enough)

### 1. Clone and install

```bash
git clone https://github.com/rajairfanahmed/fyp-advanced-subscription-and-membership-platform.git
cd fyp-advanced-subscription-and-membership-platform
npm install
```

### 2. PostgreSQL

Create the database, then apply the schema (this is the project’s database bootstrap — there is no separate seed dump of demo users):

```bash
psql -U postgres -c "CREATE DATABASE \"AdvancedSubscription_MembershipPlatform\";"
psql -U postgres -d AdvancedSubscription_MembershipPlatform -f scripts/postgres/schema.sql
```

Optional sanity check:

```bash
node scripts/postgres/check-counts.mjs
```

### 3. Environment

```bash
cp .env.example .env.local
```

Fill Clerk, Stripe, R2, and `DATABASE_URL`. Leave real keys in `.env.local` only.

### 4. Clerk dashboard

Enable email + password, email verification at sign-up, password reset, and Google if you use it. Add `http://localhost:3000` to allowed redirect origins. Put your evaluator/admin email in `ADMIN_EMAILS`.

### 5. Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## Environment variables

Templates: [`.env.example`](.env.example) and [`.env.local.example`](.env.local.example). **Do not commit `.env.local`.**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key |
| `CLERK_SECRET_KEY` | Clerk server key |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLOUDFLARE_R2_*` | R2 account, keys, bucket, public URL |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_APP_URL` | Checkout / portal return base URL |
| `ADMIN_EMAILS` | Comma-separated admin allowlist |
| `CRON_SECRET` | Bearer/`?secret=` gate for daily analytics rollup (required in production) |

Clerk path overrides (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, etc.) are listed in `.env.example`.

---

## Demo script for the panel

Use three accounts: a **subscriber**, a **creator**, and an email in `ADMIN_EMAILS`.

1. Creator publishes a Free PDF and a Basic/Premium file. Confirm paid plan shows Subscribe when Stripe is synced.
2. Subscriber Follows (free), opens Free content, downloads a PDF (file saves; tab does not preview it).
3. Subscriber pays Basic or Premium on **that** creator, then opens locked items.
4. Subscriber cancels a paid plan — access remains until period end.
5. Admin suspends the subscriber — checkout and download return 403. Restore the account.
6. Optional: enable maintenance mode and show the public `/maintenance` page.

---

## What this project does not include

These are intentional, not missing work:

- Stripe Connect, creator payouts, or platform commission
- Email/SMS campaigns (billing notices are **in-app**)
- A platform-wide membership that unlocks every creator
- Automated end-to-end test suite
- Production hosting (Vercel cron is defined in `vercel.json` for the daily rollup)

---

## License

Academic Final Year Project. All rights reserved by the author.
