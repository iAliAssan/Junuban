import { orderStatusLabel, paymentAttemptStatusLabel, paymentMethodLabel } from "./order-status-labels";

describe("orderStatusLabel", () => {
  it("maps every known backend status to a Persian label", () => {
    expect(orderStatusLabel("PENDING_PAYMENT")).toBe("در انتظار پرداخت");
    expect(orderStatusLabel("PAID")).toBe("پرداخت‌شده");
    expect(orderStatusLabel("DELIVERED")).toBe("تحویل داده‌شده");
  });

  it("falls back to the raw status string for an unrecognized value rather than throwing", () => {
    expect(orderStatusLabel("SOME_FUTURE_STATUS")).toBe("SOME_FUTURE_STATUS");
  });
});

describe("paymentAttemptStatusLabel", () => {
  it("maps known payment attempt statuses", () => {
    expect(paymentAttemptStatusLabel("REQUIRES_CONFIRMATION")).toBe("در انتظار تایید دستی");
    expect(paymentAttemptStatusLabel("SUCCEEDED")).toBe("موفق");
  });

  it("falls back gracefully for unknown values", () => {
    expect(paymentAttemptStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("paymentMethodLabel", () => {
  it("maps known payment methods", () => {
    expect(paymentMethodLabel("CARD_TO_CARD")).toBe("کارت به کارت");
    expect(paymentMethodLabel("SHEBA")).toBe("انتقال شبا");
  });
});
