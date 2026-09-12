export const MAX_PAGE_SIZE = 60;
export const DEFAULT_PAGE_SIZE = 24;

export interface ResolvedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Clamps page/pageSize to safe bounds server-side. DTO-level
 * `class-validator` decorators already reject bad input at the HTTP
 * boundary, but this is a second, framework-independent line of defense
 * — never trust client-side (or even DTO-level) validation alone for
 * something that directly controls query cost (see security §35).
 */
export function resolvePagination(page?: number, pageSize?: number): ResolvedPagination {
  const safePage = Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1;
  const requestedSize = Number.isFinite(pageSize) && (pageSize as number) >= 1 ? Math.floor(pageSize as number) : DEFAULT_PAGE_SIZE;
  const safePageSize = Math.min(requestedSize, MAX_PAGE_SIZE);

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
