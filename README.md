# Advanced Subscription & Membership Platform

> A full-stack SaaS platform that lets creators publish premium content and monetize it through subscription plans, while giving members a clean place to discover, subscribe and consume that content. Built as a Final Year Project (FYP).

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Payments-Stripe-635bff?logo=stripe)](https://stripe.com/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6c47ff)](https://clerk.com/)
[![Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare_R2-f38020?logo=cloudflare)](https://www.cloudflare.com/products/r2/)

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Folder Structure](#folder-structure)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [External Services Setup](#external-services-setup)
9. [Available Scripts](#available-scripts)
10. [User Roles](#user-roles)
11. [Project Status](#project-status)
12. [License](#license)

---

## Overview

**Advanced Subscription & Membership Platform** is a multi-role subscription and membership platform inspired by services like Patreon, Substack and OnlyFans (SFW use-case). It allows:

- **Creators** to publish gated content (articles, videos, downloads) and define subscription tiers.
- **Members / Subscribers** to discover creators, subscribe to plans, consume content and manage their subscriptions.
- **Admins** to oversee users, content, payments, subscriptions and platform-wide analytics.

The whole stack is built on **Next.js (App Router)** with TypeScript, MongoDB for data, Stripe for billing, Clerk for authentication, and Cloudflare R2 for object storage of large media.

---

## Key Features

### Authentication and Authorization
- Email/password signup with email verification (Clerk).
- Password reset via email code.
- Google OAuth social login.
- Role-based access control: `admin`, `creator`, `subscriber`.
- Middleware-protected routes for `/admin`, `/creator`, `/library`, `/billing`, etc.
- Admin allowlist via `ADMIN_EMAILS` environment variable.

### Subscriptions and Payments (Stripe)
- Multiple subscription tiers per creator with configurable pricing and storage limits.
- Stripe Checkout for plan upgrades.
- Stripe Customer Portal for self-serve billing management.
- Webhook handling for subscription lifecycle events (created, updated, canceled, payment failed).
- Admin tools to retry or refund payments.
- Default plan templates and per-tier limits in `src/config/`.

### Content Management
- Creators can upload articles, video links and downloadable files.
- Content can be marked free, member-only or tier-gated.
- Per-content view, event and download tracking.
- Per-subscriber download quotas.
- Article rendering with a clean reading layout.
- Public preview grid for non-subscribers.

### Storage (Cloudflare R2)
- S3-compatible R2 object storage for uploads (covers, attachments, downloadables).
- Per-creator storage limits enforced in application logic.
- Signed upload route for secure direct-to-R2 uploads.

### Dashboards
- **Creator Dashboard**: content library, plan editor, subscriber list, revenue, analytics, settings.
- **Admin Dashboard**: users, creators, subscribers, content moderation, plans, payments, subscriptions, settings, analytics, notifications, maintenance mode.
- **Member Library**: subscribed content, content detail pages, account and billing pages.

### Analytics
- Per-creator analytics: views, signups, revenue trends.
- Daily rollup cron route for aggregating analytics.
- Platform-wide admin analytics.

### Notifications
- In-app notification center.
- Notification persistence in MongoDB.

### Other Niceties
- Smooth scrolling powered by Lenis.
- Animations via Framer Motion.
- Custom cursor and themed UI primitives.
- CSV export utility for admins.
- Maintenance-mode page and toggle.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Server Components, Route Handlers) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| Smooth Scroll | [Lenis](https://github.com/darkroomengineering/lenis) |
| Auth | [Clerk](https://clerk.com/) (`@clerk/nextjs`) |
| Database | [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/) |
| Payments | [Stripe](https://stripe.com/) (`stripe` SDK + webhooks) |
| Object Storage | [Cloudflare R2](https://www.cloudflare.com/products/r2/) via `@aws-sdk/client-s3` |
| Linting | ESLint 9 + `eslint-config-next` |
| Hosting | Vercel (configured) / Cloudflare (planned) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                       │
│   Public site │ Member library │ Creator studio │ Admin panel   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                       Next.js (App Router)
        ┌──────────────────────┴────────────────────────┐
        │                                                │
   Server Components                              Route Handlers
   (data fetching,                                (REST API in
    auth-aware UI)                                 src/app/api/*)
        │                                                │
        └──────────────────────┬─────────────────────────┘
                               │
       ┌───────────────┬───────┴────────┬─────────────────────┐
       ▼               ▼                ▼                     ▼
   Clerk Auth     MongoDB (Mongoose)   Stripe API       Cloudflare R2
   (sessions,     (users, plans,       (checkout,       (uploads,
    OAuth, JWT)    subscriptions,       portal,          covers,
                   content, events,     webhooks)        downloads)
                   notifications,
                   analytics)
```

- **Middleware** (`src/middleware.ts`) gates routes by role and handles maintenance mode.
- **Stripe webhook** (`src/app/api/webhooks/stripe/route.ts`) keeps Mongo in sync with Stripe.
- **Cron route** (`src/app/api/cron/analytics/daily-rollup/route.ts`) aggregates daily metrics.

---

## Folder Structure

```
src/
├── app/                     # Next.js App Router (pages + API routes)
│   ├── (public pages)       # /, /pricing, /about, /contact, /support, /creators, ...
│   ├── login, sign-up,      # Clerk-powered auth pages
│   │   forgot-password,
│   │   reset-password,
│   │   verify-email,
│   │   sso-callback
│   ├── library/             # Member content library + content detail
│   ├── account/             # Member account settings
│   ├── billing/             # Stripe billing portal entry
│   ├── subscription/        # Subscription management
│   ├── notifications/       # In-app notifications
│   ├── creator/             # Creator studio (content, plans, subscribers,
│   │                        #   analytics, revenue, settings)
│   ├── admin/               # Admin panel (users, creators, subscribers,
│   │                        #   content, plans, subscriptions, payments,
│   │                        #   analytics, notifications, settings)
│   └── api/                 # Route handlers (REST endpoints)
│       ├── auth/            # Session helpers, role checks, redirect
│       ├── account/         # Account delete, profile
│       ├── content/         # CRUD, view, event, download
│       ├── plans/           # Plan management
│       ├── checkout/        # Stripe checkout session
│       ├── billing-portal/  # Stripe portal session
│       ├── webhooks/stripe/ # Stripe webhook receiver
│       ├── storage/upload/  # Cloudflare R2 signed upload
│       ├── creator/         # Creator-only endpoints
│       ├── admin/           # Admin-only endpoints
│       ├── public/          # Public-readable endpoints
│       └── cron/            # Scheduled tasks (analytics rollup)
│
├── components/              # Reusable UI components
│   ├── ui/                  # Base primitives (Button, Cursor, ...)
│   ├── layout/              # Header, footer, shells
│   ├── forms/               # ContentForm, plan forms, etc.
│   ├── cards/               # ContentCard, SubscriberContentCard, previews
│   ├── tables/              # Data tables
│   ├── dashboard/           # DashboardShell and widgets
│   ├── navigation/          # MainNav and nav helpers
│   └── article/             # ArticleBody renderer
│
├── features/                # Feature modules (auth, plans, content, ...)
├── lib/                     # Service integrations and helpers
│   ├── mongodb/             # Mongoose models, connection, queries
│   ├── stripe/              # Stripe client, checkout, portal, webhook, plan-sync
│   ├── storage/             # Cloudflare R2 client and helpers
│   ├── auth/                # Profile sync, session helpers, redirects
│   └── csv.ts               # CSV export helper
│
├── config/                  # Tier limits, default plans, storage limits
├── data/                    # Static data and seeds
├── hooks/                   # Custom React hooks
├── styles/                  # Global styles
├── types/                   # Shared TypeScript types
└── middleware.ts            # Route protection + maintenance mode
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (or `pnpm` / `yarn`)
- A **MongoDB** instance (local or Atlas)
- A **Clerk** account
- A **Stripe** account (test mode is fine)
- A **Cloudflare R2** bucket (optional for local dev if you don't upload)

### 1. Clone the repository

```bash
git clone <repository-url>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.local.example .env.local
```

See [Environment Variables](#environment-variables) below for the full list.

### 4. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Forward Stripe webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## Environment Variables

All variables live in `.env.local` (which is git-ignored). A safe template lives in `.env.local.example`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (client-side). |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Path to sign-in page (`/login`). |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Path to sign-up page (`/sign-up`). |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Where to send users after login. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Where to send users after signup. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Fallback after sign-in. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Fallback after sign-up. |
| `MONGODB_URI` | MongoDB connection string. |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare account ID for R2. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 access key. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret key. |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name. |
| `CLOUDFLARE_R2_PUBLIC_URL` | Public base URL of the R2 bucket. |
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live). |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side). |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses. |

> **Never commit `.env.local`.** It is excluded from version control via `.gitignore`.

---

## External Services Setup

### Clerk Dashboard

1. **Identifiers:** enable Email address and Password.
2. **Verification at sign-up:** "Email verification code".
3. **Password reset:** enable "Allow password reset" (email code strategy).
4. **Social Connections:** enable Google and add your Google OAuth Client ID + Secret.
5. **Allowed redirect origins:** add `http://localhost:3000` (and your production domain when deploying).

### Stripe Dashboard

1. Create products and prices that match the plans defined in `src/config/default-plans.ts`.
2. Add a webhook endpoint pointing to `/api/webhooks/stripe` and subscribe to subscription + invoice events.
3. Copy the webhook signing secret into `.env.local`.

### Cloudflare R2

1. Create a bucket and an API token with read/write scope.
2. Configure a public domain or signed URLs for the bucket.
3. Paste the credentials and bucket name into `.env.local`.

### MongoDB

- Local: install MongoDB Community and use `postgresql://postgres:123@localhost:5432/AdvancedSubscription_MembershipPlatform`.
- Atlas: create a cluster and copy the connection string.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Create an optimized production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | Run ESLint on the project. |

---

## User Roles

| Role | Default Landing | Capabilities |
|---|---|---|
| **Subscriber** (default) | `/library` | Browse creators, subscribe to plans, consume content, manage account and billing. |
| **Creator** | `/creator` | Manage content, plans, subscribers, revenue and analytics. |
| **Admin** | `/admin` | Full platform oversight: users, creators, subscribers, content moderation, plans, subscriptions, payments, settings, maintenance, analytics. |

Admins are determined via the `ADMIN_EMAILS` environment variable. Creators are upgraded from the admin panel or via the creator onboarding flow.

---

## Project Status

This is an **active Final Year Project**. Core flows are implemented and integrated end-to-end.

- [x] Folder structure and Next.js base
- [x] Clerk authentication (email/password, Google, password reset)
- [x] MongoDB models and connection
- [x] Stripe Checkout, Customer Portal and webhooks
- [x] Cloudflare R2 uploads
- [x] Creator studio (content, plans, subscribers, analytics, revenue)
- [x] Admin panel (users, creators, content, plans, subscriptions, payments, analytics, settings)
- [x] Member library and content viewing
- [x] Per-plan storage and download quotas
- [x] Maintenance-mode toggle
- [x] Daily analytics rollup cron route
- [ ] Production deployment (Cloudflare / Vercel) finalized
- [ ] End-to-end test suite

---

## License

This project is part of an academic Final Year Project. All rights reserved by the author. For inquiries about reuse, please open an issue or contact the maintainer.

---

> Built with care by **Raja Irfan Ahmed** as part of the Advanced Subscription & Membership Platform FYP.
