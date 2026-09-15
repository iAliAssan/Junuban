import { normalizeIranianMobile } from "./phone.util";

describe("normalizeIranianMobile", () => {
  it("normalizes a local 09xxxxxxxxx number", () => {
    expect(normalizeIranianMobile("09121234567")).toBe("+989121234567");
  });

  it("normalizes a number already in E.164 form", () => {
    expect(normalizeIranianMobile("+989121234567")).toBe("+989121234567");
  });

  it("normalizes a 989xxxxxxxxx number without the plus sign", () => {
    expect(normalizeIranianMobile("989121234567")).toBe("+989121234567");
  });

  it("strips spaces and dashes before validating", () => {
    expect(normalizeIranianMobile("0912 123-4567")).toBe("+989121234567");
  });

  it("rejects numbers that are too short", () => {
    expect(normalizeIranianMobile("0912123456")).toBeNull();
  });

  it("rejects numbers that are too long", () => {
    expect(normalizeIranianMobile("091212345678")).toBeNull();
  });

  it("rejects non-mobile Iranian numbers (e.g. landline prefix)", () => {
    expect(normalizeIranianMobile("02112345678")).toBeNull();
  });

  it("rejects clearly invalid input", () => {
    expect(normalizeIranianMobile("not-a-phone-number")).toBeNull();
  });
});
