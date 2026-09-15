import { isRecordId } from "@/lib/db/ids";
import { NextResponse, type NextRequest } from "next/server";

import { adminErrorJson } from "@/lib/auth/admin-http";
import { auditAdmin, requireAdminMutation } from "@/lib/auth/require-admin";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { ContentModel } from "@/lib/mongodb/models";
import { recalcCreatorContentCount } from "@/lib/mongodb/creator-counts";
import { createNotification } from "@/lib/mongodb/notifications";

type Action = "approve" | "archive" | "draft";

/**
 * PATCH /api/admin/content/[contentId]
 * Body: { action: "approve" | "archive" | "draft" }
 *
 * Admin-only override on creator-owned content. Lets the platform
 * publish a queued submission, archive abusive/broken content, or
 * push something back to draft for the creator to re-edit. The
 * creator gets an in-app notification so the action isn't silent.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ contentId: string }> }
) {
  try {
    const ctx = await requireAdminMutation(req);
    const { contentId } = await context.params;
    if (!isRecordId(contentId)) {
      return NextResponse.json({ error: "Invalid content id." }, { status: 400 });
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = String(
      (body as { action?: unknown }).action ?? ""
    ).toLowerCase() as Action;

    if (action !== "approve" && action !== "archive" && action !== "draft") {
      return NextResponse.json(
        { error: "`action` must be 'approve', 'archive', or 'draft'." },
        { status: 400 }
      );
    }

    await connectToMongoDB();
    const before = await ContentModel.findById(contentId);
    if (!before) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }

    const previousStatus = before.status;

    if (action === "approve") {
      before.status = "published";
      if (!before.publishedAt) before.publishedAt = new Date();
    } else if (action === "archive") {
      before.status = "archived";
    } else {
      before.status = "draft";
    }
    await before.save();

    if (previousStatus !== before.status) {
      try {
        await recalcCreatorContentCount(before.creatorClerkUserId);
      } catch (error) {
        console.warn("[admin:content:recalc-count]", error);
      }
      try {
        const message =
          action === "approve"
            ? `An admin approved "${before.title}" and it is now published.`
            : action === "archive"
              ? `An admin archived "${before.title}". Subscribers can no longer access it.`
              : `An admin moved "${before.title}" back to Draft. Edit and resubmit when ready.`;
        await createNotification({
          recipientClerkUserId: before.creatorClerkUserId,
          category: "content",
          title:
            action === "approve"
              ? "Content approved"
              : action === "archive"
                ? "Content archived"
                : "Content moved to draft",
          message,
          link: `/creator/content/${before._id.toString()}/edit`,
        });
      } catch (error) {
        console.warn("[admin:content:notify]", error);
      }
    }

    await auditAdmin(ctx, req, {
      action: `content.${action}`,
      targetType: "content",
      targetId: before._id.toString(),
      payload: { previousStatus, status: before.status, title: before.title },
    });

    return NextResponse.json(
      {
        ok: true,
        id: before._id.toString(),
        status: before.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin:content:patch]", error);
    return adminErrorJson(error, "Failed to update content.");
  }
}
