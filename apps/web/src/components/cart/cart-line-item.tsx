"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./cart-line-item.module.css";
import { QuantityStepper } from "./quantity-stepper";
import { formatToman, toPersianDigits } from "@/lib/format";
import type { CartItemView } from "@/lib/cart-client";

export function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItemView;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  onRemove: (itemId: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleQuantityChange(next: number) {
    if (busy || next === item.quantity) return;
    setBusy(true);
    await onUpdateQuantity(item.id, next);
    setBusy(false);
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    await onRemove(item.id);
    // No need to reset `busy` on success — the item unmounts with the list re-render.
  }

  return (
    <div className={styles.line}>
      <div className={styles.imageWrap}>
        {item.image ? (
          <Image src={item.image.url} alt={item.image.altText} fill sizes="96px" />
        ) : (
          <div className={styles.placeholderImage} aria-hidden="true">
            بدون تصویر
          </div>
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.name}>
              <Link href={`/products/${item.productSlug}`}>{item.productName}</Link>
            </p>
            <p className={styles.meta}>
              {item.producerName} — {item.weightLabel}
              {item.packagingName ? ` — ${item.packagingName}` : ""}
            </p>
          </div>
          <button
            type="button"
            className={styles.removeButton}
            disabled={busy}
            onClick={handleRemove}
            aria-label={`حذف ${item.productName} از سبد خرید`}
          >
            حذف
          </button>
        </div>

        {item.hasAvailabilityIssue && (
          <p className={styles.availabilityWarning} role="alert">
            {item.availablePackages === 0
              ? "این کالا دیگر موجود نیست"
              : `تنها ${toPersianDigits(item.availablePackages)} بسته موجود است — تعداد را کاهش دهید`}
          </p>
        )}

        <div className={styles.bottomRow}>
          <QuantityStepper
            quantity={item.quantity}
            onChange={handleQuantityChange}
            disabled={busy}
            label={`تعداد ${item.productName}`}
          />
          <div className={styles.priceBlock}>
            <span className={styles.unitPrice}>
              {formatToman(item.unitPrice + item.packagingPriceDelta)} × {toPersianDigits(item.quantity)}
            </span>
            <span className={styles.lineTotal}>{formatToman(item.lineTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
