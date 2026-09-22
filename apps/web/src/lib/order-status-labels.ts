export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل داده‌شده",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگردانده‌شده",
};

export const PAYMENT_ATTEMPT_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  REQUIRES_CONFIRMATION: "در انتظار تایید دستی",
  SUCCEEDED: "موفق",
  FAILED: "ناموفق",
  CANCELLED: "لغوشده",
  REFUNDED: "بازگردانده‌شده",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD_TO_CARD: "کارت به کارت",
  SHEBA: "انتقال شبا",
  ONLINE: "پرداخت آنلاین",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function paymentAttemptStatusLabel(status: string): string {
  return PAYMENT_ATTEMPT_STATUS_LABELS[status] ?? status;
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/**
 * Mirrors apps/api/src/orders/order-status.util.ts's ALLOWED_TRANSITIONS
 * exactly. Duplicated here (rather than imported) because the web app
 * doesn't share a package with the API — if that transition graph ever
 * changes on the backend, this must be updated to match, or the admin
 * UI will offer a status button that the API then rejects with a 400.
 * PENDING_PAYMENT and PAID are omitted as *targets* here on purpose:
 * PAID has its own dedicated "تایید پرداخت" action (see
 * admin-order-detail-client.tsx), not this generic status control.
 */
const ADMIN_NEXT_STATUSES: Record<string, Array<"PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED">> =
  {
    PENDING_PAYMENT: ["CANCELLED"],
    PAID: ["PROCESSING", "REFUNDED", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: [],
    REFUNDED: [],
  };

export function adminNextStatuses(currentStatus: string) {
  return ADMIN_NEXT_STATUSES[currentStatus] ?? [];
}

/**
 * Semantic color-token group for a given order status, shared between
 * every place that renders a status badge (orders-list-client.tsx,
 * order-detail-client.tsx, track-order). Rather than have each page
 * duplicate its own `Record<status, cssModuleClassName>` map (CSS
 * Modules scope class names per-file, so the class names themselves
 * can't be shared directly across files) each page maps this token
 * name to its own locally-scoped CSS class — one lookup table here
 * instead of N near-identical ones.
 */
export type OrderStatusColorToken = "pending" | "info" | "success" | "error";

const STATUS_COLOR_TOKENS: Record<string, OrderStatusColorToken> = {
  PENDING_PAYMENT: "pending",
  PAID: "info",
  PROCESSING: "info",
  SHIPPED: "success",
  DELIVERED: "success",
  CANCELLED: "error",
  REFUNDED: "error",
};

export function orderStatusColorToken(status: string): OrderStatusColorToken {
  return STATUS_COLOR_TOKENS[status] ?? "pending";
}
