import { Pool } from "pg";

let pool: Pool | null = null;

/** Vercel env pastes often wrap the URL or include Neon’s channel_binding flag, which node-pg rejects. */
export function sanitizeDatabaseUrl(raw: string) {
  let url = raw.trim().replace(/\s+/g, "");
  url = url.replace(/[&?]channel_binding=[^&]*/gi, "");
  url = url.replace(/\?&/g, "?").replace(/&&/g, "&");
  if (url.endsWith("?") || url.endsWith("&")) url = url.slice(0, -1);
  return url;
}

function isLocalPostgres(connectionString: string) {
  try {
    const host = new URL(connectionString).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return (
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
    );
  }
}

export function getPool(): Pool {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env.local (postgresql://postgres:123@localhost:5432/AdvancedSubscription_MembershipPlatform)."
    );
  }
  const connectionString = sanitizeDatabaseUrl(raw);
  const local = isLocalPostgres(connectionString);
  pool = new Pool({
    connectionString,
    max: local ? 10 : 3,
    connectionTimeoutMillis: 15000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

export async function pgQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params);
}
