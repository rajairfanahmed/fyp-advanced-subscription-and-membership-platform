import { pgQuery } from "@/lib/db/pool";

let ensured = false;

async function ensureStripeEventTables() {
  if (ensured) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  try {
    await pgQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_invoice_unique
      ON payments (stripe_invoice_id)
      WHERE stripe_invoice_id IS NOT NULL AND stripe_invoice_id <> ''
    `);
  } catch (error) {
    console.warn("[stripe-events] unique invoice index", error);
  }
  ensured = true;
}

/**
 * Returns true when this Stripe event id has not been processed yet.
 * Duplicate deliveries return false and must be acknowledged with HTTP 200.
 */
export async function claimStripeWebhookEvent(
  eventId: string,
  eventType: string
): Promise<boolean> {
  if (!eventId.trim()) return true;
  await ensureStripeEventTables();
  const res = await pgQuery(
    `INSERT INTO stripe_webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId.trim(), eventType.trim().slice(0, 120)]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function releaseStripeWebhookEvent(eventId: string): Promise<void> {
  if (!eventId.trim()) return;
  await pgQuery(`DELETE FROM stripe_webhook_events WHERE event_id = $1`, [eventId.trim()]);
}
