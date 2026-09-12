import type { ProductListQuery } from "./api";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const VALID_SORTS = new Set(["newest", "price_asc", "price_desc", "best_selling"]);

/**
 * Never trusts the incoming URL — this runs on the server before the
 * value is forwarded to the API, so a malformed/hostile query string
 * degrades to sane defaults instead of propagating garbage further in.
 */
export function parseProductListSearchParams(params: RawSearchParams): ProductListQuery {
  const sort = first(params.sort);
  const page = parseIntOrUndefined(first(params.page));

  return {
    q: first(params.q)?.slice(0, 120) || undefined,
    categorySlug: first(params.categorySlug) || undefined,
    producerSlug: first(params.producerSlug) || undefined,
    minPrice: parseIntOrUndefined(first(params.minPrice)),
    maxPrice: parseIntOrUndefined(first(params.maxPrice)),
    inStockOnly: first(params.inStockOnly) === "true",
    sort: sort && VALID_SORTS.has(sort) ? (sort as ProductListQuery["sort"]) : undefined,
    page: page && page >= 1 ? page : 1,
  };
}
