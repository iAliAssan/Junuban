export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

/**
 * Valid forward/side transitions for an order. Cancellation is only
 * allowed before fulfillment has meaningfully started; refund is only
 * meaningful after payment succeeded. This is intentionally the smallest
 * state model that supports the current single-seller flow — see
 * IMPLEMENTATION_STATUS.md for why PENDING_PAYMENT (not a separate
 * PENDING + PAYMENT_PENDING pair) is the entry state: it was already
 * the locked schema default from Cycle 1, and introducing a second,
 * near-duplicate "PENDING" state would violate "do not blindly introduce
 * duplicate/conflicting statuses."
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "REFUNDED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function isValidOrderStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextAllowedStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
