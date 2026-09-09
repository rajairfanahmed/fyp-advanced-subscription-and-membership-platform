const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function isMongoObjectId(value: string) {
  return MONGO_ID_RE.test(value);
}

/** True when the value can identify a Postgres row (uuid) or a migrated Mongo row. */
export function isRecordId(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const id = value.trim();
  return isUuid(id) || isMongoObjectId(id);
}

export function idLookupSql(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `(${p}id::text = $ID OR ${p}legacy_mongo_id = $ID)`;
}
