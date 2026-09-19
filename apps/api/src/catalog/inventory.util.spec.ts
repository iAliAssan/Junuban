import { availablePackages, gramsForOrder } from "./inventory.util";

describe("availablePackages", () => {
  it("computes floor((onHand - reserved) / weight)", () => {
    expect(availablePackages(10000, 0, 500)).toBe(20);
    expect(availablePackages(10000, 2000, 500)).toBe(16);
  });

  it("never returns a negative number when reserved exceeds on-hand", () => {
    expect(availablePackages(1000, 5000, 500)).toBe(0);
  });

  it("returns 0 for a zero or negative weight to avoid division errors", () => {
    expect(availablePackages(10000, 0, 0)).toBe(0);
    expect(availablePackages(10000, 0, -100)).toBe(0);
  });

  it("floors partial packages rather than rounding", () => {
    // 999g available at 500g/package = 1 package, not 2.
    expect(availablePackages(999, 0, 500)).toBe(1);
  });
});

describe("gramsForOrder", () => {
  it("multiplies weight by quantity (never a per-kg price formula)", () => {
    expect(gramsForOrder(500, 3)).toBe(1500);
  });
});
