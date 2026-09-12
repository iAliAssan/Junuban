import { validateShippingAddress, validateGuestPhone, hasErrors } from "./checkout-validation";

describe("validateShippingAddress", () => {
  const VALID = {
    recipientName: "علی محمدی",
    phone: "09121234567",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزادی، پلاک ۱",
    postalCode: "1234567890",
  };

  it("returns no errors for a fully valid address", () => {
    expect(validateShippingAddress(VALID)).toEqual({});
  });

  it("flags every required field as missing when empty", () => {
    const errors = validateShippingAddress({});
    expect(Object.keys(errors).sort()).toEqual(
      ["addressLine", "city", "phone", "postalCode", "province", "recipientName"].sort(),
    );
  });

  it("flags an invalid phone format", () => {
    expect(validateShippingAddress({ ...VALID, phone: "123" }).phone).toBeDefined();
  });

  it("flags a postal code that isn't exactly 10 digits", () => {
    expect(validateShippingAddress({ ...VALID, postalCode: "123" }).postalCode).toBeDefined();
    expect(validateShippingAddress({ ...VALID, postalCode: "12345678901" }).postalCode).toBeDefined();
  });

  it("treats whitespace-only input as missing, not valid", () => {
    expect(validateShippingAddress({ ...VALID, recipientName: "   " }).recipientName).toBeDefined();
  });
});

describe("validateGuestPhone", () => {
  it("requires nothing when the customer is authenticated", () => {
    expect(validateGuestPhone(undefined, true)).toEqual({});
  });

  it("requires a phone number for guest checkout", () => {
    expect(hasErrors(validateGuestPhone(undefined, false))).toBe(true);
  });

  it("accepts a valid guest phone number", () => {
    expect(validateGuestPhone("09121234567", false)).toEqual({});
  });

  it("rejects an invalid guest phone number", () => {
    expect(hasErrors(validateGuestPhone("not-a-phone", false))).toBe(true);
  });
});

describe("hasErrors", () => {
  it("is false for an empty error object", () => {
    expect(hasErrors({})).toBe(false);
  });

  it("is true when at least one field has an error", () => {
    expect(hasErrors({ phone: "invalid" })).toBe(true);
  });
});
