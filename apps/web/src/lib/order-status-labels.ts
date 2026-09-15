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
