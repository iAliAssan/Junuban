import { KavenegarSmsProvider, GhasedakSmsProvider, SmsDeliveryError } from "./sms-provider";

function mockFetchOnce(response: { ok: boolean; status?: number; jsonBody?: unknown; jsonThrows?: boolean }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => {
      if (response.jsonThrows) throw new Error("invalid json");
      return response.jsonBody;
    },
  } as unknown as Response);
}

describe("KavenegarSmsProvider", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves when Kavenegar reports return.status 200", async () => {
    global.fetch = mockFetchOnce({ ok: true, jsonBody: { return: { status: 200, message: "OK" } } });
    const provider = new KavenegarSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).resolves.toBeUndefined();
  });

  it("sends the phone number without the leading +", async () => {
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { return: { status: 200 } } });
    global.fetch = fetchMock;
    const provider = new KavenegarSmsProvider("test-key");
    await provider.sendOtp("+989121234567", "123456");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("receptor=989121234567");
    expect(calledUrl).not.toContain("receptor=%2B989121234567");
  });

  it("throws SmsDeliveryError when Kavenegar reports a non-200 business status", async () => {
    global.fetch = mockFetchOnce({ ok: true, jsonBody: { return: { status: 400, message: "Bad receptor" } } });
    const provider = new KavenegarSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).rejects.toThrow(SmsDeliveryError);
  });

  it("throws SmsDeliveryError when the HTTP call itself fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const provider = new KavenegarSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).rejects.toThrow(SmsDeliveryError);
  });

  it("throws SmsDeliveryError when the response body isn't valid JSON", async () => {
    global.fetch = mockFetchOnce({ ok: true, jsonThrows: true });
    const provider = new KavenegarSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).rejects.toThrow(SmsDeliveryError);
  });
});

describe("GhasedakSmsProvider", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves when Ghasedak reports result.code 200", async () => {
    global.fetch = mockFetchOnce({ ok: true, jsonBody: { result: { code: 200, message: "OK" } } });
    const provider = new GhasedakSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).resolves.toBeUndefined();
  });

  it("throws SmsDeliveryError when Ghasedak reports a failure code", async () => {
    global.fetch = mockFetchOnce({ ok: true, jsonBody: { result: { code: 411, message: "Invalid receptor" } } });
    const provider = new GhasedakSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).rejects.toThrow(SmsDeliveryError);
  });

  it("throws SmsDeliveryError when the HTTP call itself fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    const provider = new GhasedakSmsProvider("test-key");
    await expect(provider.sendOtp("+989121234567", "123456")).rejects.toThrow(SmsDeliveryError);
  });
});
