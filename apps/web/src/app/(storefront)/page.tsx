import type { Metadata } from "next";
import { apiGet, classifyLoadError, type CategorySummary, type ProducerSummary, type ProductListResponse } from "@/lib/api";
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
  const [categoriesResult, bestSellersResult, newestResult, producersResult] = await Promise.allSettled([
    apiGet<CategorySummary[]>("/categories"),
    apiGet<ProductListResponse>("/products?sort=best_selling&pageSize=8"),
    apiGet<ProductListResponse>("/products?sort=newest&pageSize=8"),
    apiGet<ProducerSummary[]>("/producers"),
  ]);

  const categories =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c._count.products,
          photo: c.photo,
        }))
      : [];

  // NOTE: a public site-settings endpoint (hero stats, promo banner
  // copy) is not yet implemented (planned for a future cycle — see
  // IMPLEMENTATION_STATUS.md). Rather than fabricate hero stats or
  // promo copy, those sections render their real empty/omitted state
  // until that endpoint exists. /producers, however, IS implemented
  // (see apps/api/src/catalog/catalog.controller.ts) — the strip below
  // uses it for real, rather than rendering an empty list.
  const heroStats = null;
  const featuredProduct = null;
  const promoContent = null;
  // A handful of verified producers, featured first — same "don't show
  // more than the section needs" sizing as the two product sections above.
  const featuredProducers = (producersResult.status === "fulfilled" ? producersResult.value : [])
    .slice()
    .sort((a, b) => Number(b.verified) - Number(a.verified))
    .slice(0, 8);

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
