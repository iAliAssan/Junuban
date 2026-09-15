"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { formatToman } from "@/lib/format";
import styles from "./cart-page.module.css";

export function CartPageClient() {
  const { cart, status, error, mutationError, refresh, updateItemQuantity, removeItem } = useCart();

  return (
    <div className={styles.layout}>
      <div className="container">
        <h1 className={styles.title}>سبد خرید</h1>

        {status === "loading" && !cart && (
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
          </div>
        )}

        {status === "error" && (
          <div className={styles.errorState} role="alert">
            <p>{error ?? "بارگذاری سبد خرید با خطا مواجه شد."}</p>
            <button type="button" className={styles.retryButton} onClick={() => refresh()}>
              تلاش مجدد
            </button>
          </div>
        )}

        {status === "ready" && cart && cart.items.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle}>سبد خرید شما خالی است.</p>
            <p>محصولات جنوبان را مشاهده کنید و آنچه دوست دارید را به سبد خود اضافه کنید.</p>
            <Link href="/products" className={styles.continueLink}>
              مشاهده محصولات ←
            </Link>
          </div>
        )}

        {status === "ready" && cart && cart.items.length > 0 && (
          <div className={styles.grid}>
            <div className={styles.itemsCard}>
              {mutationError && (
                <p className={styles.mutationError} role="alert" style={{ marginTop: "var(--space-5)" }}>
                  {mutationError}
                </p>
              )}
              {cart.items.map((item) => (
                <CartLineItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateItemQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            <aside className={styles.summaryCard}>
              <p className={styles.summaryTitle}>خلاصه سفارش</p>
              <div className={styles.summaryRow}>
                <span>جمع کالاها</span>
                <span>{formatToman(cart.subtotal)}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span>مجموع</span>
                <span>{formatToman(cart.total)}</span>
              </div>

              {/* Checkout doesn't exist yet this cycle — see IMPLEMENTATION_STATUS.md.
                  No button is shown rather than linking somewhere that doesn't work. */}
              {/* Block checkout when any line has an unresolved availability
                  issue — the server would reject it anyway, but catching
                  it here avoids a pointless round-trip and confusing error. */}
              {cart.items.some((i) => i.hasAvailabilityIssue) ? (
                <p className={styles.checkoutNote}>
                  برای تکمیل خرید، ابتدا موجودی کالاهای مشخص‌شده را اصلاح کنید.
                </p>
              ) : (
                <Link href="/checkout" className={styles.checkoutButton}>
                  تکمیل خرید
                </Link>
              )}

              <Link href="/products" className={styles.continueLink}>
                ادامه خرید ←
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
