import { formatOrderNumber, randomOrderSuffix } from "./order-number.util";

describe("formatOrderNumber", () => {
  it("formats as JB-YYYYMMDD-SUFFIX with zero-padded month/day", () => {
    expect(formatOrderNumber(new Date(2026, 0, 5), "ab12cd")).toBe("JB-20260105-AB12CD");
  });

  it("uppercases the suffix", () => {
    expect(formatOrderNumber(new Date(2026, 8, 12), "zzzzzz")).toBe("JB-20260912-ZZZZZZ");
  });
});

describe("randomOrderSuffix", () => {
  it("always returns a 6-character string", () => {
    for (let i = 0; i < 20; i++) {
      expect(randomOrderSuffix()).toHaveLength(6);
    }
  });
});
