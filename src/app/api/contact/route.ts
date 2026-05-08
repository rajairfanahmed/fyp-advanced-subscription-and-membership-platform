import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import { ContactModel, UserProfileModel } from "@/lib/mongodb/models";
import { createNotification } from "@/lib/mongodb/notifications";
import { getAdminEmails } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_LIMIT = 80;
const EMAIL_LIMIT = 200;
const ROLE_LIMIT = 30;
const TOPIC_LIMIT = 60;
const MESSAGE_MIN = 10;
const MESSAGE_LIMIT = 2000;

const ALLOWED_ROLES = new Set([
  "Visitor",
  "Subscriber",
  "Creator",
  "Admin",
  "Other",
  "",
]);

const ALLOWED_TOPICS = new Set([
  "Account Access",
  "Billing",
  "Subscription Plans",
  "Content Access",
  "Creator Tools",
  "Admin Controls",
  "General Question",
  "",
]);

function cleanString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const body = payload as Record<string, unknown>;
  const fullName = cleanString(body.fullName, NAME_LIMIT);
  const email = cleanString(body.email, EMAIL_LIMIT).toLowerCase();
  const role = cleanString(body.role, ROLE_LIMIT);
  const topic = cleanString(body.topic, TOPIC_LIMIT);
  const message = cleanString(body.message, MESSAGE_LIMIT);

  if (!fullName) {
    return NextResponse.json({ error: "Please share your name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please use a valid email address." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Unsupported role." }, { status: 400 });
  }
  if (!ALLOWED_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Unsupported topic." }, { status: 400 });
  }
  if (message.length < MESSAGE_MIN) {
    return NextResponse.json(
      { error: "Please describe how we can help in a little more detail." },
      { status: 400 }
    );
  }

  let submitterClerkUserId: string | null = null;
  try {
    const { userId } = await auth();
    submitterClerkUserId = userId ?? null;
  } catch {
    submitterClerkUserId = null;
  }

  await connectToMongoDB();

  const adminEmails = getAdminEmails();
  let adminClerkUserIds: string[] = [];
  if (adminEmails.length > 0) {
    const admins = await UserProfileModel.find(
      { email: { $in: adminEmails } },
      { clerkUserId: 1 }
    ).lean();
    adminClerkUserIds = admins
      .map((a) => (a as { clerkUserId?: string }).clerkUserId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
  }

  const subject = `Contact form: ${topic || "General Question"}`;
  const body_text = [
    `From: ${fullName} <${email}>`,
    role ? `Role: ${role}` : null,
    topic ? `Topic: ${topic}` : null,
    "",
    message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const metadata = {
    source: "contact_form",
    fullName,
    email,
    role,
    topic,
    submitterClerkUserId,
  } as const;

  // Best-effort fan-out to every admin currently in the system. If
  // no admin profiles exist yet (fresh deployment) we still want the
  // submission to be recorded — fall back to delivering the message
  // to the submitter themselves if they're signed in, so it isn't lost.
  let delivered = 0;
  for (const adminId of adminClerkUserIds) {
    try {
      await createNotification({
        recipientClerkUserId: adminId,
        category: "system",
        title: subject.slice(0, 120),
        message: body_text.slice(0, 600),
        link: "/admin/notifications",
        metadata,
      });
      delivered += 1;
    } catch (err) {
      console.error("[POST /api/contact] failed to notify admin", adminId, err);
    }
  }

  if (delivered === 0 && submitterClerkUserId) {
    try {
      await createNotification({
        recipientClerkUserId: submitterClerkUserId,
        category: "system",
        title: "Message received",
        message:
          "Thanks for reaching out. We'll route your message to the team and reply to your email shortly.",
        link: "/contact",
        metadata,
      });
    } catch (err) {
      console.error("[POST /api/contact] echo notification failed", err);
    }
  }

  // Persist the submission so the admin team has a permanent
  // record even if all notification channels fail.
  try {
    await ContactModel.create({
      fullName,
      email,
      role,
      topic,
      message,
      submitterClerkUserId: submitterClerkUserId ?? "",
      deliveredToAdminCount: delivered,
      status: "new",
      metadata,
    });
  } catch (err) {
    console.error("[POST /api/contact] failed to persist contact", err);
  }

  return NextResponse.json({
    ok: true,
    deliveredToAdmins: delivered,
  });
}
