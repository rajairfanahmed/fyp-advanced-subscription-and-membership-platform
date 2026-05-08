/**
 * Minimal CSV serializer. We deliberately avoid pulling in a runtime
 * dependency for a few exports — the only quirky bit is RFC 4180
 * field escaping (commas, quotes, newlines).
 */

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (str === "") return "";
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export type CsvRow = Record<string, string | number | null | undefined>;

export function toCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeField(row[header])).join(","));
  }
  // Excel-friendly BOM so non-ASCII names render correctly when the
  // file is opened by double-click.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}

export function csvTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
