import type { MetadataRoute } from "next";
import { apiGet, ApiError } from "@/lib/api";
import type { CategorySummary, ProductListResponse } from "@/lib/api";

/**
 * Only lists routes that actually resolve to a real page in this
 * repository right now (see master prompt §19 — "do not generate
 * misleading structured data" applies equally to sitemap entries).
 * Content pages like /about, /contact, /authenticity etc. are NOT
 * listed yet because those routes don't exist in the app yet — add
 * them here in the cycle that implements them, not before.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let productRoutes: MetadataRoute.Sitemap = [];

  try {
    const categories = await apiGet<CategorySummary[]>("/categories", 3600);
    categoryRoutes = categories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    // API unreachable at build time — ship the static routes only rather
    // than failing the whole sitemap (and therefore the build).
  }

  try {
    // Bounded: first page only, matching the max page size. A future
    // cycle should paginate this properly once the catalog is large
    // enough for it to matter.
    const products = await apiGet<ProductListResponse>("/products?pageSize=60", 3600);
    productRoutes = products.items.map((p) => ({
      url: `${baseUrl}/products/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
