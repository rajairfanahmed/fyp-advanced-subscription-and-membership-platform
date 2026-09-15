import { NextResponse } from "next/server";

import {
  clientIp,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ACTIONS = {
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 15 * 60 * 1000 },
  "forgot-password": { limit: 3, windowMs: 15 * 60 * 1000 },
} as const;

type Action = keyof typeof ACTIONS;

function isAction(value: unknown): value is Action {
  return typeof value === "string" && value in ACTIONS;
}

/**
 * POST /api/auth/throttle
 *
 * Counts an authentication attempt against the caller IP. Login, sign-up,
 * and forgot-password forms must call this before talking to Clerk so
 * credential stuffing never reaches the identity provider unbounded.
 */
export async function POST(req: Request) {
  let action: unknown;
  try {
    const body = (await req.json()) as { action?: unknown };
    action = body?.action;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isAction(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const policy = ACTIONS[action];
  const result = rateLimit(
    `auth:${action}:${clientIp(req)}`,
    policy.limit,
    policy.windowMs
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: rateLimitHeaders(result) }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: rateLimitHeaders(result) });
}
