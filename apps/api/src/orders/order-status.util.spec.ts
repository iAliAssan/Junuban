import { isValidOrderStatusTransition, nextAllowedStatuses } from "./order-status.util";

describe("isValidOrderStatusTransition", () => {
  it("allows the normal fulfillment path", () => {
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(isValidOrderStatusTransition("PAID", "PROCESSING")).toBe(true);
    expect(isValidOrderStatusTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(isValidOrderStatusTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("allows cancellation before fulfillment starts", () => {
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "CANCELLED")).toBe(true);
    expect(isValidOrderStatusTransition("PAID", "CANCELLED")).toBe(true);
  });

  it("does not allow cancellation once shipped or delivered", () => {
    expect(isValidOrderStatusTransition("PROCESSING", "CANCELLED")).toBe(true); // still before shipping
    expect(isValidOrderStatusTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(isValidOrderStatusTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("allows refund only after payment succeeded", () => {
    expect(isValidOrderStatusTransition("PAID", "REFUNDED")).toBe(true);
    expect(isValidOrderStatusTransition("DELIVERED", "REFUNDED")).toBe(true);
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "REFUNDED")).toBe(false);
  });

  it("never allows skipping straight from pending payment to shipped/delivered", () => {
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(isValidOrderStatusTransition("PENDING_PAYMENT", "DELIVERED")).toBe(false);
  });

  it("treats CANCELLED and REFUNDED as terminal — no transitions out", () => {
    expect(nextAllowedStatuses("CANCELLED")).toEqual([]);
    expect(nextAllowedStatuses("REFUNDED")).toEqual([]);
  });

  it("never allows a status to transition to itself", () => {
    const statuses: Array<Parameters<typeof isValidOrderStatusTransition>[0]> = [
      "PENDING_PAYMENT",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ];
    for (const s of statuses) {
      expect(isValidOrderStatusTransition(s, s)).toBe(false);
    }
  });
});
