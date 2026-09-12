const API_BASE_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetches from the real backend API. Deliberately does NOT return
 * fabricated fallback data on failure — callers must render a genuine
 * loading/empty/error state instead (see master prompt §26, "no fake
 * functionality"). Uses Next.js ISR-style caching for public catalog data.
 *
 * Both HTTP-level failures (non-2xx response) AND network-level failures
 * (API completely unreachable — connection refused, DNS failure, etc.)
 * surface as ApiError, so callers checking `instanceof ApiError` behave
 * consistently regardless of which kind of failure occurred. This matters
 * most for build-time callers like sitemap.ts: a totally-unreachable API
 * throws a raw fetch TypeError, not an HTTP error — without this catch,
 * that would slip past an `instanceof ApiError` check and fail the build.
 */
export async function apiGet<T>(path: string, revalidateSeconds = 60): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      next: { revalidate: revalidateSeconds },
    });
  } catch {
    throw new ApiError(`ارتباط با سرور برای ${path} برقرار نشد`);
  }

  if (!res.ok) {
    throw new ApiError(`درخواست به ${path} با خطا مواجه شد`, res.status);
  }

  return (await res.json()) as T;
}

/**
 * Same as apiGet, but resolves to `null` on a 404 instead of throwing —
 * for pages that should call Next.js `notFound()` on a missing slug
 * rather than rendering a generic error state. Any other failure still
 * throws ApiError, since that's a real error, not "doesn't exist".
 */
export async function apiGetOrNotFound<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    return await apiGet<T>(path, revalidateSeconds);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  iconKey: string | null;
  _count: { products: number };
}

export interface ProducerSummary {
  id: string;
  slug: string;
  name: string;
  region: string;
  verified: boolean;
}

export interface PackagingOptionSummary {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  image: { url: string; altText: string } | null;
  category: { slug: string; name: string };
  producer: { name: string; region: string } | null;
  producerCount: number;
  weightLabels: string[];
  priceFrom: number | null;
  hasMultiplePrices: boolean;
  inStock: boolean;
  lowStock: boolean;
  avgRating: number | null;
  reviewCount: number;
}

export interface ProductListResponse {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductVariantDetail {
  id: string;
  sku: string;
  price: number;
  weightOptionId: string;
  weightLabel: string;
  grams: number;
  availablePackages: number;
}

export interface ProductProducerDetail {
  productProducerId: string;
  producer: {
    slug: string;
    name: string;
    region: string;
    bio: string | null;
    verified: boolean;
  };
  isDefault: boolean;
  variants: ProductVariantDetail[];
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  harvestSeason: string | null;
  category: { slug: string; name: string };
  images: { url: string; altText: string }[];
  avgRating: number | null;
  reviewCount: number;
  weightOptions: { id: string; label: string; grams: number }[];
  producers: ProductProducerDetail[];
  packagingOptions: PackagingOptionSummary[];
}

/**
 * Classifies a `Promise.allSettled` result for a catalog fetch into a
 * user-facing error message, or `undefined` when there is no error.
 *
 * Critically: a **fulfilled** promise always returns `undefined` here,
 * even when the resolved data is an empty array/list — "the request
 * succeeded and there's nothing to show" is never an error state. Only
 * a **rejected** promise (the request itself failed) produces a message.
 * Extracted as a pure function specifically so this guarantee is unit
 * tested independent of any page component.
 */
export function classifyLoadError(result: PromiseSettledResult<unknown>): string | undefined {
  if (result.status === "fulfilled") return undefined;

  return result.reason instanceof ApiError
    ? "در حال حاضر امکان بارگذاری اطلاعات وجود ندارد. لطفاً بعداً دوباره تلاش کنید."
    : "خطایی در ارتباط با سرور رخ داد.";
}

export interface ProductListQuery {
  q?: string;
  categorySlug?: string;
  producerSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "best_selling";
  page?: number;
  pageSize?: number;
}

/** Builds a `/products` query string, omitting empty/undefined values. */
export function buildProductQuery(query: ProductListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.categorySlug) params.set("categorySlug", query.categorySlug);
  if (query.producerSlug) params.set("producerSlug", query.producerSlug);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.inStockOnly) params.set("inStockOnly", "true");
  if (query.sort) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
