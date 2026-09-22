"use client";

import { useState } from "react";
import Link from "next/link";
import { checkoutApi, CheckoutApiError, type OrderView } from "@/lib/checkout-client";
import { orderStatusLabel, orderStatusColorToken } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./track-order.module.css";

const COLOR_TOKEN_TO_CLASS = {
  pending: "statusPending",
  info: "statusInfo",
  success: "statusSuccess",
  error: "statusError",
} as const;

export function TrackOrderPageClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const found = await checkoutApi.trackOrder(orderNumber.trim().toUpperCase(), phone.trim());
      setOrder(found);
    } catch (err) {
      setFormError(err instanceof CheckoutApiError ? err.message : "پیگیری سفارش با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewSearch() {
    setOrder(null);
    setFormError(null);
  }

  if (order) {
    const colorClass = styles[COLOR_TOKEN_TO_CLASS[orderStatusColorToken(order.status)]];
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.resultLayout}>
            <span className={`${styles.statusBadge} ${colorClass}`}>{orderStatusLabel(order.status)}</span>
            <h1 className={styles.title}>سفارش {toPersianDigits(order.orderNumber)}</h1>
            <p className={styles.subtitle}>تاریخ ثبت: {new Date(order.createdAt).toLocaleDateString("fa-IR")}</p>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>کالاها</h2>
              {order.items.map((item) => (
                <div key={item.id} className={styles.itemGroup}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <p>{item.productNameSnapshot}</p>
                      <p className={styles.itemMeta}>
                        {item.producerNameSnapshot} — {item.weightLabelSnapshot} × {toPersianDigits(item.quantity)}
                      </p>
                    </div>
                    <span>{formatToman(item.unitPriceSnapshot * item.quantity)}</span>
                  </div>
                  {item.packagingNameSnapshot && (
                    <div className={styles.itemRow}>
                      <p className={styles.itemMeta}>
                        {item.packagingNameSnapshot} × {toPersianDigits(item.quantity)}
                      </p>
                      <span>{formatToman(item.packagingPriceSnapshot * item.quantity)}</span>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {order.customerNote && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>توضیحات سفارش</h2>
                <p className={styles.itemMeta}>{order.customerNote}</p>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.summaryRow}>
                <span>جمع کالاها</span>
                <span>{formatToman(order.subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>هزینه ارسال</span>
                <span>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span>مبلغ قابل پرداخت</span>
                <span>{formatToman(order.total)}</span>
              </div>
            </section>

            <p className={styles.centered}>
              <button type="button" className={styles.newSearchLink} onClick={handleNewSearch}>
                پیگیری سفارش دیگر ←
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className="container">
        <h1 className={`${styles.title} ${styles.centered}`}>پیگیری سفارش</h1>
        <p className={`${styles.subtitle} ${styles.centered}`}>
          شماره سفارش و شماره موبایلی که هنگام ثبت سفارش استفاده کرده‌اید را وارد کنید.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="track-order-number">شماره سفارش</label>
            <input
              id="track-order-number"
              placeholder="AU-GXM14L7"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="track-phone">شماره موبایل</label>
            <input
              id="track-phone"
              type="tel"
              inputMode="numeric"
              placeholder="09121234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={submitting}>
            {submitting ? "در حال جستجو..." : "پیگیری سفارش"}
          </button>
        </form>

        <p className={styles.centered}>
          <Link href="/orders" className={styles.newSearchLink}>
            یا مشاهده سفارش‌های حساب کاربری خود ←
          </Link>
        </p>
      </div>
    </div>
  );
}
