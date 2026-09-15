"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, AdminApiError, type AdminOrderView } from "@/lib/admin-orders-client";
import { orderStatusLabel, paymentAttemptStatusLabel, paymentMethodLabel } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./admin-order-detail.module.css";

// Manual-confirmation payment methods only (card-to-card / Sheba) can
// ever need the mark-paid action — an ONLINE gateway attempt confirms
// itself via its own callback, not an admin click. Kept in sync with
// backend §11 ("card-to-card and Sheba require manual confirmation").
const MANUAL_CONFIRMATION_METHODS = new Set(["CARD_TO_CARD", "SHEBA"]);

export function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function load() {
    adminApi
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        setLoadError(null);
        setNotFound(false);
      })
      .catch((err) => {
        if (err instanceof AdminApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(err instanceof AdminApiError ? err.message : "بارگذاری سفارش با خطا مواجه شد");
        }
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleMarkPaid() {
    if (confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const updated = await adminApi.markOrderPaid(orderId);
      setOrder(updated);
    } catch (err) {
      setConfirmError(err instanceof AdminApiError ? err.message : "تایید پرداخت با خطا مواجه شد");
    } finally {
      setConfirming(false);
    }
  }

  if (notFound) {
    return (
      <div className={styles.errorState} role="alert">
        <p>این سفارش یافت نشد.</p>
        <Link href="/admin/orders" className={styles.backLink}>
          ← بازگشت به سفارش‌ها
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <p className={styles.errorState} role="alert">
        {loadError}
      </p>
    );
  }

  if (!order) {
    return <p role="status">در حال بارگذاری...</p>;
  }

  const canMarkPaid = order.status === "PENDING_PAYMENT";
  const hasManualPaymentAttempt = order.paymentAttempts.some((a) => MANUAL_CONFIRMATION_METHODS.has(a.method));

  return (
    <div>
      <Link href="/admin/orders" className={styles.backLink}>
        ← بازگشت به سفارش‌ها
      </Link>
      <h1 className={styles.title}>سفارش {order.orderNumber}</h1>

      <div className={styles.detailGrid}>
        <div>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>کالاها</h2>
            {order.items.map((item) => (
              <div key={item.id} className={styles.itemRow}>
                <div>
                  <p>{item.productNameSnapshot}</p>
                  <p className={styles.itemMeta}>
                    {item.producerNameSnapshot} — {item.weightLabelSnapshot}
                    {item.packagingNameSnapshot ? ` — ${item.packagingNameSnapshot}` : ""} ×{" "}
                    {toPersianDigits(item.quantity)}
                  </p>
                </div>
                <span>{formatToman(item.lineTotal)}</span>
              </div>
            ))}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>مشتری و آدرس تحویل</h2>
            <p className={styles.addressText}>
              {order.shippingAddress.recipientName} — {order.shippingAddress.phone}
              <br />
              {order.shippingAddress.province}، {order.shippingAddress.city}
              <br />
              {order.shippingAddress.addressLine}
              <br />
              کد پستی: {toPersianDigits(order.shippingAddress.postalCode)}
            </p>
          </section>

          {order.paymentAttempts.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>وضعیت پرداخت</h2>
              {order.paymentAttempts.map((attempt) => (
                <div key={attempt.id} className={styles.itemRow}>
                  <span>{paymentMethodLabel(attempt.method)}</span>
                  <span>{paymentAttemptStatusLabel(attempt.status)}</span>
                </div>
              ))}
            </section>
          )}

          {canMarkPaid && hasManualPaymentAttempt && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>تایید پرداخت دستی</h2>
              <p className={styles.itemMeta}>
                در صورت دریافت و تطبیق مبلغ کارت‌به‌کارت یا شبا، پرداخت این سفارش را تایید کنید.
              </p>
              {confirmError && (
                <p className={styles.confirmError} role="alert">
                  {confirmError}
                </p>
              )}
              <button type="button" className={styles.confirmButton} onClick={handleMarkPaid} disabled={confirming}>
                {confirming ? "در حال تایید..." : "تایید پرداخت"}
              </button>
            </section>
          )}
        </div>

        <aside className={styles.section}>
          <h2 className={styles.sectionTitle}>خلاصه سفارش</h2>
          <p className={styles.itemMeta}>تاریخ ثبت: {new Date(order.createdAt).toLocaleDateString("fa-IR")}</p>
          <div className={styles.summaryRow}>
            <span>وضعیت سفارش</span>
            <span>{orderStatusLabel(order.status)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>جمع کالاها</span>
            <span>{formatToman(order.subtotal)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>هزینه ارسال</span>
            <span>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span>
          </div>
          <div className={styles.summaryTotalRow}>
            <span>مجموع</span>
            <span>{formatToman(order.total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
