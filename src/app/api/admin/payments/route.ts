import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminPayments } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const data = await getAdminPayments();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const csv = toCsv(
        [
          "ID",
          "Subscriber",
          "Email",
          "Creator",
          "Amount",
          "Currency",
          "Status",
          "Method",
          "Paid At",
          "Created At",
        ],
        data.payments.map((p) => ({
          ID: p.id,
          Subscriber: p.subscriberName,
          Email: p.subscriberEmail,
          Creator: p.creatorName,
          Amount: (p.amountCents / 100).toFixed(2),
          Currency: p.currency.toUpperCase(),
          Status: p.status,
          Method: p.paymentMethodLabel,
          "Paid At": p.paidAt ?? "",
          "Created At": p.createdAt,
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`payments-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load payments.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:payments]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
