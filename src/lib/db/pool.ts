import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env.local (postgresql://postgres:123@localhost:5432/AdvancedSubscription_MembershipPlatform)."
    );
  }
  pool = new Pool({
    connectionString,
    max: 10,
  });
  return pool;
}

export async function pgQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params);
}
