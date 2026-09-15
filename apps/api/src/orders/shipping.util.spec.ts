import { calculateShippingCost } from "./shipping.util";

describe("calculateShippingCost", () => {
  it("charges the flat rate when below the free-shipping threshold", () => {
    expect(
      calculateShippingCost(500_000, { flatRateToman: 350_000, freeThresholdToman: 2_000_000, freeEnabled: true }),
    ).toBe(350_000);
  });

  it("is free at or above the threshold when free shipping is enabled", () => {
    expect(
      calculateShippingCost(2_000_000, { flatRateToman: 350_000, freeThresholdToman: 2_000_000, freeEnabled: true }),
    ).toBe(0);
    expect(
      calculateShippingCost(3_000_000, { flatRateToman: 350_000, freeThresholdToman: 2_000_000, freeEnabled: true }),
    ).toBe(0);
  });

  it("always charges the flat rate when free shipping is disabled, regardless of subtotal", () => {
    expect(
      calculateShippingCost(5_000_000, { flatRateToman: 350_000, freeThresholdToman: 2_000_000, freeEnabled: false }),
    ).toBe(350_000);
  });

  it("charges the flat rate when no threshold is configured, even if free shipping is enabled", () => {
    expect(calculateShippingCost(5_000_000, { flatRateToman: 350_000, freeEnabled: true })).toBe(350_000);
  });
});
