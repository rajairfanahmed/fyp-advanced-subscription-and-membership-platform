import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminPayments } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminPayments(list);
    if (list.csv) {
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
    console.error("[admin:payments]", error);
    return adminErrorJson(error, "Failed to load payments.");
  }
}
