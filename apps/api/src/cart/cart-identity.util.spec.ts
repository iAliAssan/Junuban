import {
  clampQuantity,
  sameCartLine,
  normalizePackagingOptionId,
  MIN_CART_QUANTITY,
  MAX_CART_QUANTITY,
} from "./cart-identity.util";

describe("clampQuantity", () => {
  it("passes through values already in range", () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(50)).toBe(50);
    expect(clampQuantity(99)).toBe(99);
  });

  it("clamps below the minimum up to 1", () => {
    expect(clampQuantity(0)).toBe(MIN_CART_QUANTITY);
    expect(clampQuantity(-5)).toBe(MIN_CART_QUANTITY);
  });

  it("clamps above the maximum down to 99", () => {
    expect(clampQuantity(100)).toBe(MAX_CART_QUANTITY);
    expect(clampQuantity(999999)).toBe(MAX_CART_QUANTITY);
  });

  it("floors fractional quantities", () => {
    expect(clampQuantity(2.9)).toBe(2);
  });

  it("falls back to the minimum for non-finite/garbage input rather than throwing", () => {
    expect(clampQuantity(Number.NaN)).toBe(MIN_CART_QUANTITY);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(MIN_CART_QUANTITY);
  });
});

describe("sameCartLine", () => {
  it("matches when variant and packaging are identical", () => {
    expect(
      sameCartLine({ variantId: "v1", packagingOptionId: "p1" }, { variantId: "v1", packagingOptionId: "p1" }),
    ).toBe(true);
  });

  it("matches when both have no packaging (null)", () => {
    expect(
      sameCartLine({ variantId: "v1", packagingOptionId: null }, { variantId: "v1", packagingOptionId: null }),
    ).toBe(true);
  });

  it("treats different packaging as a different line, even for the same variant", () => {
    expect(
      sameCartLine({ variantId: "v1", packagingOptionId: "p1" }, { variantId: "v1", packagingOptionId: "p2" }),
    ).toBe(false);
  });

  it("treats packaging vs. no packaging as different lines", () => {
    expect(
      sameCartLine({ variantId: "v1", packagingOptionId: "p1" }, { variantId: "v1", packagingOptionId: null }),
    ).toBe(false);
  });

  it("treats different variants as different lines even with identical packaging", () => {
    expect(
      sameCartLine({ variantId: "v1", packagingOptionId: null }, { variantId: "v2", packagingOptionId: null }),
    ).toBe(false);
  });
});

describe("normalizePackagingOptionId", () => {
  it("converts undefined to null", () => {
    expect(normalizePackagingOptionId(undefined)).toBeNull();
  });

  it("passes null through", () => {
    expect(normalizePackagingOptionId(null)).toBeNull();
  });

  it("passes a real id through unchanged", () => {
    expect(normalizePackagingOptionId("abc-123")).toBe("abc-123");
  });
});
