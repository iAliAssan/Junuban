import { formatTomanForBackend } from "./money.util";

describe("formatTomanForBackend", () => {
  it("adds thousands separators", () => {
    expect(formatTomanForBackend(1234567)).toBe("1,234,567");
  });

  it("handles small amounts without separators", () => {
    expect(formatTomanForBackend(500)).toBe("500");
  });

  it("handles zero", () => {
    expect(formatTomanForBackend(0)).toBe("0");
  });
});
