import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const c = new pg.Client({ connectionString: m[1].trim() });
await c.connect();
const db = await c.query("SELECT current_database() AS db");
const tables = await c.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
);
const names = [
  "user_profiles",
  "creator_profiles",
  "creator_workspace_alerts",
  "creator_workspace_defaults",
  "subscriber_profiles",
  "subscriber_notification_preferences",
  "subscriber_preferred_content_types",
  "plans",
  "plan_features",
  "content",
  "subscriptions",
  "payments",
  "notifications",
  "analytics",
  "contacts",
  "platform_settings",
  "migration_quarantine",
];
console.log("DATABASE:", db.rows[0].db);
console.log("TABLES:", tables.rows.map((r) => r.tablename).join(", "));
console.log("COUNTS:");
for (const t of names) {
  const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
  console.log(" ", t, r.rows[0].n);
}
await c.end();
