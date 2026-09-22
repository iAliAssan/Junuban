import { formatOrderNumber, randomOrderSuffix } from "./order-number.util";

describe("formatOrderNumber", () => {
  it("formats as AU-SUFFIX", () => {
    expect(formatOrderNumber("gxm14l7")).toBe("AU-GXM14L7");
  });

  it("uppercases the suffix", () => {
    expect(formatOrderNumber("zzzzzzz")).toBe("AU-ZZZZZZZ");
  });
});

describe("randomOrderSuffix", () => {
  it("always returns a 7-character string", () => {
    for (let i = 0; i < 20; i++) {
      expect(randomOrderSuffix()).toHaveLength(7);
    }
  });

  it("only uses uppercase alphanumeric (base36-style) characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomOrderSuffix()).toMatch(/^[0-9A-Z]{7}$/);
    }
  });

  it("produces different values across calls (not a fixed/degenerate output)", () => {
    const values = new Set(Array.from({ length: 50 }, () => randomOrderSuffix()));
    // Not a strict uniqueness guarantee (that's the DB's job, per
    // OrdersService's collision-check-and-retry loop) — just a sanity
    // check that this isn't secretly returning the same string every time.
    expect(values.size).toBeGreaterThan(40);
  });
});
