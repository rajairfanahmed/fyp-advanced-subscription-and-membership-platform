import { pgQuery } from "@/lib/db/pool";

let ensured = false;

async function ensureAdminAuditTable() {
  if (ensured) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS admin_audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_clerk_user_id VARCHAR(64) NOT NULL,
      actor_email VARCHAR(320) NOT NULL DEFAULT '',
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(40) NOT NULL DEFAULT '',
      target_id VARCHAR(80) NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip VARCHAR(128) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pgQuery(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created
    ON admin_audit_events (created_at DESC)
  `);
  ensured = true;
}

export type AdminAuditInput = {
  actorClerkUserId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ip?: string;
};

export async function recordAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    await ensureAdminAuditTable();
    await pgQuery(
      `INSERT INTO admin_audit_events (
         actor_clerk_user_id, actor_email, action, target_type, target_id, payload, ip
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        input.actorClerkUserId,
        input.actorEmail.slice(0, 320),
        input.action.slice(0, 80),
        (input.targetType ?? "").slice(0, 40),
        (input.targetId ?? "").slice(0, 80),
        JSON.stringify(input.payload ?? {}),
        (input.ip ?? "").slice(0, 128),
      ]
    );
  } catch (error) {
    console.warn("[admin:audit]", error);
  }
}
