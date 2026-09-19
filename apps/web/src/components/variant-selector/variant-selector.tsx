"use client";

import { useState } from "react";
import styles from "./variant-selector.module.css";
import { formatToman, toPersianDigits } from "@/lib/format";
import { resolveSelectedVariant, availableWeightOptionIds } from "@/lib/variant-selection";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { useCart } from "@/components/cart/cart-provider";
import type { ProductDetail } from "@/lib/api";

export function VariantSelector({ product }: { product: ProductDetail }) {
  const defaultProducer = product.producers.find((p) => p.isDefault) ?? product.producers[0] ?? null;

  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(
    defaultProducer?.productProducerId ?? null,
  );
  const [selectedWeightOptionId, setSelectedWeightOptionId] = useState<string | null>(null);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string | null>(
    product.packagingOptions[0]?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { addItem } = useCart();

  const { producer, variant } = resolveSelectedVariant(product, selectedProducerId, selectedWeightOptionId);
  const offeredWeightIds = availableWeightOptionIds(producer);

  if (!producer || !variant) {
    return (
      <div className={styles.section}>
        <p className={styles.skuNote}>این محصول در حال حاضر برای هیچ تولیدکننده‌ای موجود نیست.</p>
      </div>
    );
  }

  const outOfStock = variant.availablePackages === 0;
  const availabilityLabel = outOfStock
    ? "ناموجود"
    : variant.availablePackages <= 3
      ? `فقط ${toPersianDigits(variant.availablePackages)} بسته باقی مانده`
      : "موجود در انبار";

  const availabilityClass = outOfStock
    ? styles.availabilityOut
    : variant.availablePackages <= 3
      ? styles.availabilityLow
      : styles.availabilityInStock;

  async function handleAddToCart() {
    if (adding || outOfStock || !variant) return; // prevent accidental double submission
    setAdding(true);
    setFeedback(null);

    const ok = await addItem({
      variantId: variant.id,
      packagingOptionId: selectedPackagingId ?? undefined,
      quantity,
    });

    setAdding(false);
    setFeedback(
      ok
        ? { type: "success", message: "به سبد خرید اضافه شد." }
        : { type: "error", message: "افزودن به سبد خرید با خطا مواجه شد. دوباره تلاش کنید." },
    );
  }

  return (
    <div className={styles.section}>
      {product.producers.length > 1 && (
        <fieldset className={styles.producerGroup}>
          <legend className={styles.groupLabel}>انتخاب تولیدکننده</legend>
          {product.producers.map((p) => (
            <label key={p.productProducerId} className={styles.producerOption}>
              <input
                type="radio"
                name="producer"
                value={p.productProducerId}
                checked={p.productProducerId === producer.productProducerId}
                onChange={() => {
                  setSelectedProducerId(p.productProducerId);
                  setSelectedWeightOptionId(null); // reset weight — the new producer may not offer the old one
                  setFeedback(null);
                }}
              />
              <span className={styles.producerInfo}>
                <span className={styles.producerName}>
                  {p.producer.name}
                  {p.producer.verified && (
                    <span className={styles.verifiedBadge} title="تایید شده" aria-label="تولیدکننده تایید شده">
                      ✓
                    </span>
                  )}
                </span>
                <br />
                <span className={styles.producerMeta}>{p.producer.region}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className={styles.weightGroup}>
        <legend className="visually-hidden">انتخاب وزن</legend>
        {product.weightOptions.map((w) => {
          const offered = offeredWeightIds.has(w.id);
          return (
            <span key={w.id} className={styles.weightOption}>
              <input
                type="radio"
                id={`weight-${w.id}`}
                name="weight"
                value={w.id}
                disabled={!offered}
                checked={w.id === variant.weightOptionId}
                onChange={() => {
                  setSelectedWeightOptionId(w.id);
                  setFeedback(null);
                }}
              />
              <label htmlFor={`weight-${w.id}`} className={styles.weightOptionLabel}>
                {w.label}
              </label>
            </span>
          );
        })}
      </fieldset>

      <div className={styles.priceRow}>
        <span className={styles.price}>{formatToman(variant.price)}</span>
      </div>
      <p className={`${styles.availability} ${availabilityClass}`} role="status">
        {availabilityLabel}
      </p>

      <p className={styles.skuNote}>کد کالا: {variant.sku}</p>

      {product.packagingOptions.length > 0 && (
        <fieldset className={styles.packagingGroup}>
          <legend className={styles.groupLabel}>گزینه بسته‌بندی</legend>
          {product.packagingOptions.map((po) => (
            <label key={po.id} className={styles.packagingOption}>
              <span className={styles.packagingOptionLeft}>
                <input
                  type="radio"
                  name="packaging"
                  value={po.id}
                  checked={selectedPackagingId === po.id}
                  onChange={() => {
                    setSelectedPackagingId(po.id);
                    setFeedback(null);
                  }}
                />
                <span className={styles.packagingName}>{po.name}</span>
              </span>
              <span className={styles.packagingPrice}>
                {po.priceDelta > 0 ? `+${formatToman(po.priceDelta)}` : "بدون هزینه اضافه"}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className={styles.actionRow}>
        <QuantityStepper quantity={quantity} onChange={setQuantity} disabled={adding} label="تعداد" />
        <button type="button" className={styles.addButton} disabled={adding || outOfStock} onClick={handleAddToCart}>
          {outOfStock ? "ناموجود" : adding ? "در حال افزودن..." : "افزودن به سبد خرید"}
        </button>
      </div>

      {feedback && (
        <p
          className={`${styles.feedback} ${feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
