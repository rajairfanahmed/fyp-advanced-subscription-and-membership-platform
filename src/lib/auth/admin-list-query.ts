export type AdminListQuery = {
  q: string;
  page: number;
  pageSize: number;
  skip: number;
  csv: boolean;
};

export type AdminPageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const CSV_PAGE_SIZE = 5000;

export function parseAdminListQuery(searchParams: URLSearchParams): AdminListQuery {
  const csv = searchParams.get("format")?.toLowerCase() === "csv";
  const page = Math.max(1, Math.floor(Number(searchParams.get("page") || 1)) || 1);
  const requested = Number(searchParams.get("pageSize") || DEFAULT_PAGE_SIZE);
  const pageSize = csv
    ? Math.min(CSV_PAGE_SIZE, Math.max(1, Math.floor(requested) || CSV_PAGE_SIZE))
    : Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(requested) || DEFAULT_PAGE_SIZE));
  return {
    q: (searchParams.get("q") || "").trim().slice(0, 120),
    page: csv ? 1 : page,
    pageSize,
    skip: csv ? 0 : (page - 1) * pageSize,
    csv,
  };
}

export function adminPageMeta(total: number, query: AdminListQuery): AdminPageMeta {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize) || 1);
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

export function ilikeContains(value: string): string {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}
