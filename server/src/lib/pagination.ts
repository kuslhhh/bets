// Centralized pagination parsing — mirrors the exact logic previously
// copy-pasted in assessments/assignments/users routes.

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
}

export function parsePagination(
  url: URL,
  opts: { defaultPageSize?: number; maxPageSize?: number } = {},
): Pagination {
  const defaultPageSize = opts.defaultPageSize ?? 20;
  const maxPageSize = opts.maxPageSize ?? 100;
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? defaultPageSize);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? defaultPageSize
    : Math.min(maxPageSize, Math.max(1, pageSizeRaw));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
