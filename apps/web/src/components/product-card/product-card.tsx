import Link from "next/link";
import Image from "next/image";
import styles from "./product-card.module.css";
import { formatToman } from "@/lib/format";
import type { ProductSummary } from "@/lib/api";

/**
 * A pure link card to the PDP. Deliberately has no add-to-cart or
 * favorite affordances this cycle — Cart and Wishlist are out of scope
 * (see IMPLEMENTATION_STATUS.md), and a button that visibly does nothing
 * on click would be fake functionality. Server component: no client JS
 * needed for a card that's just a styled link.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  const outOfStock = !product.inStock;

  return (
    <Link href={`/products/${product.slug}`} className={styles.card}>
      <div className={`${styles.imageWrap} ${outOfStock ? styles.outOfStock : ""}`}>
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.altText}
            fill
            sizes="(max-width: 700px) 33vw, (max-width: 1000px) 25vw, 20vw"
          />
        ) : null}

        {outOfStock && <span className={styles.badgeOverlay}>ناموجود</span>}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name}>{product.name}</h3>
        {product.producer ? (
          <p className={styles.meta}>
            {product.producer.region} — {product.producer.name}
          </p>
        ) : null}

        {product.weightLabels.length > 0 && (
          <div className={styles.weightPills}>
            {product.weightLabels.map((label) => (
              <span key={label} className={styles.weightPill}>
                {label}
              </span>
            ))}
          </div>
        )}

        {product.lowStock && <span className={styles.lowStockPill}>موجودی محدود</span>}

        <div className={styles.bottomRow}>
          {product.priceFrom !== null ? (
            <span className={styles.price}>
              {formatToman(product.priceFrom)}
              {product.hasMultiplePrices && <span className={styles.priceSuffix}> از</span>}
            </span>
          ) : (
            <span className={styles.price} style={{ color: "var(--ink-45)" }}>
              ناموجود
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
