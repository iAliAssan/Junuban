import type { Metadata } from "next";
import { apiGet, classifyLoadError, type CategorySummary, type ProductListResponse } from "@/lib/api";
import { Hero } from "@/components/hero/hero";
import { CategoryRail } from "@/components/category-rail/category-rail";
import { ProductGridSection } from "@/components/product-card/product-grid-section";
import { ProducerStrip } from "@/components/producer-strip/producer-strip";
import { PromoBanner } from "@/components/promo-banner/promo-banner";

export const metadata: Metadata = {
  title: "خانه",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [categoriesResult, bestSellersResult, newestResult] = await Promise.allSettled([
    apiGet<CategorySummary[]>("/categories"),
    apiGet<ProductListResponse>("/products?sort=best_selling&pageSize=8"),
    apiGet<ProductListResponse>("/products?sort=newest&pageSize=8"),
  ]);

  const categories =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c._count.products,
        }))
      : [];

  // NOTE: /producers and a public site-settings endpoint are not yet
  // implemented (planned for the next cycle — see IMPLEMENTATION_STATUS.md).
  // Rather than fabricate hero stats or promo copy, those sections render
  // their real empty/omitted state until the endpoints exist.
  const heroStats = null;
  const featuredProduct = null;
  const promoContent = null;
  const featuredProducers: never[] = [];

  return (
    <>
      <Hero stats={heroStats} featuredProduct={featuredProduct} />

      <CategoryRail categories={categories} />

      <ProductGridSection
        title="پرفروش‌ترین‌ها"
        viewAllHref="/products?sort=best_selling"
        products={bestSellersResult.status === "fulfilled" ? bestSellersResult.value.items : []}
        loadError={classifyLoadError(bestSellersResult)}
      />

      <ProductGridSection
        title="تازه‌ترین محصولات"
        viewAllHref="/products?sort=newest"
        products={newestResult.status === "fulfilled" ? newestResult.value.items : []}
        loadError={classifyLoadError(newestResult)}
      />

      <ProducerStrip producers={featuredProducers} />

      <PromoBanner content={promoContent} />
    </>
  );
}
