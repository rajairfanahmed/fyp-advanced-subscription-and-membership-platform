import { getPool } from "@/lib/db/pool";

/**
 * Compatibility name: the app now talks to PostgreSQL.
 * MongoDB is no longer used at runtime.
 */
export async function connectToMongoDB() {
  const pool = getPool();
  await pool.query("SELECT 1");
  return pool;
}

export { getPool };
