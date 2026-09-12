import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNotFound } from "@/lib/api";
import type { ProductDetail } from "@/lib/api";
import { Breadcrumbs } from "@/components/breadcrumbs/breadcrumbs";
import { ProductGallery } from "@/components/product-gallery/product-gallery";
import { VariantSelector } from "@/components/variant-selector/variant-selector";
import { toPersianDigits } from "@/lib/format";
import styles from "./product-detail-page.module.css";

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  return apiGetOrNotFound<ProductDetail>(`/products/${slug}`);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await loadProduct(params.slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description ?? `خرید ${product.name} اصیل جنوب ایران، مستقیم از تولیدکننده.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await loadProduct(params.slug);
  if (!product) {
    notFound();
  }

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const allPrices = product.producers.flatMap((p) => p.variants.map((v) => v.price));
  const anyInStock = product.producers.some((p) => p.variants.some((v) => v.availablePackages > 0));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((i) => i.url),
    category: product.category.name,
    ...(allPrices.length > 0
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "IRR",
            lowPrice: Math.min(...allPrices),
            highPrice: Math.max(...allPrices),
            availability: anyInStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
    ...(product.avgRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avgRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <div className={styles.layout}>
      <Breadcrumbs
        baseUrl={baseUrl}
        items={[
          { label: "خانه", href: "/" },
          { label: "محصولات", href: "/products" },
          { label: product.category.name, href: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="container">
        <div className={styles.grid}>
          <ProductGallery images={product.images} productName={product.name} />

          <div>
            <p className={styles.categoryLabel}>{product.category.name}</p>
            <h1 className={styles.title}>{product.name}</h1>

            {product.avgRating !== null && (
              <p className={styles.ratingRow}>
                <span>★ {toPersianDigits(product.avgRating.toFixed(1))}</span>
                <span>({toPersianDigits(product.reviewCount)} نظر)</span>
              </p>
            )}

            {product.harvestSeason && <span className={styles.harvestBadge}>{product.harvestSeason}</span>}

            <VariantSelector product={product} />

            {product.description && <p className={styles.description}>{product.description}</p>}
          </div>
        </div>

        {product.producers.length > 0 && (
          <div className={styles.producerCard}>
            <h2 className={styles.producerCardTitle}>درباره تولیدکننده</h2>
            {product.producers.map((p) => (
              <div key={p.productProducerId} className={styles.producerEntry}>
                <p className={styles.producerEntryName}>
                  {p.producer.name} — {p.producer.region}
                </p>
                {p.producer.bio && <p className={styles.producerBio}>{p.producer.bio}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
    </div>
  );
}
