"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, AdminApiError, type AdminOrderView } from "@/lib/admin-orders-client";
import { orderStatusLabel, paymentAttemptStatusLabel, paymentMethodLabel, adminNextStatuses } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Toast } from "@/components/admin/toast";
import styles from "./admin-order-detail.module.css";

// Manual-confirmation payment methods only (card-to-card / Sheba) can
// ever need the mark-paid action — an ONLINE gateway attempt confirms
// itself via its own callback, not an admin click. Kept in sync with
// backend §11 ("card-to-card and Sheba require manual confirmation").
const MANUAL_CONFIRMATION_METHODS = new Set(["CARD_TO_CARD", "SHEBA"]);

const RESTOCKING_STATUSES = new Set(["CANCELLED", "REFUNDED"]);

export function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingDestructiveStatus, setPendingDestructiveStatus] = useState<
    "CANCELLED" | "REFUNDED" | null
  >(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  async function applyStatus(status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED") {
    setStatusPending(true);
    setStatusError(null);
    try {
      const updated = await adminApi.setOrderStatus(orderId, status);
      setOrder(updated);
      setToastMessage(`وضعیت سفارش به «${orderStatusLabel(status)}» تغییر یافت`);
    } catch (err) {
      setStatusError(err instanceof AdminApiError ? err.message : "تغییر وضعیت سفارش با خطا مواجه شد");
    } finally {
      setStatusPending(false);
      setPendingDestructiveStatus(null);
    }
  }

  function handleStatusClick(status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED") {
    if (statusPending) return;
    setStatusError(null);
    if (RESTOCKING_STATUSES.has(status)) {
      // Cancelling/refunding an already-paid order restocks inventory
      // (see OrdersService.adminSetStatus on the backend) — a real,
      // consequential side effect, so it gets a confirmation step rather
      // than firing on a single misclick.
      setPendingDestructiveStatus(status as "CANCELLED" | "REFUNDED");
      return;
    }
    void applyStatus(status);
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
  const nextStatuses = adminNextStatuses(order.status);

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

          {nextStatuses.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>تغییر وضعیت سفارش</h2>
              {statusError && (
                <p className={styles.confirmError} role="alert">
                  {statusError}
                </p>
              )}
              <div className={styles.statusActions}>
                {nextStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={RESTOCKING_STATUSES.has(status) ? styles.statusButtonDestructive : styles.statusButton}
                    onClick={() => handleStatusClick(status)}
                    disabled={statusPending}
                  >
                    {orderStatusLabel(status)}
                  </button>
                ))}
              </div>
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

      <ConfirmDialog
        open={pendingDestructiveStatus !== null}
        title={
          pendingDestructiveStatus === "CANCELLED"
            ? "لغو این سفارش؟"
            : "بازگرداندن وجه این سفارش؟"
        }
        description="این عملیات موجودی کالاهای این سفارش را به انبار بازمی‌گرداند و قابل بازگشت نیست."
        confirmLabel={pendingDestructiveStatus === "CANCELLED" ? "لغو سفارش" : "تایید بازگشت وجه"}
        destructive
        pending={statusPending}
        onConfirm={() => pendingDestructiveStatus && applyStatus(pendingDestructiveStatus)}
        onCancel={() => setPendingDestructiveStatus(null)}
      />
      <Toast message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
