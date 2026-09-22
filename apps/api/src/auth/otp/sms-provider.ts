export interface SmsProvider {
  /** Sends an OTP code to `phone`. Must never throw for a merely-slow provider — resolve/reject clearly. */
  sendOtp(phone: string, code: string): Promise<void>;
}

/**
 * Development-only stub. Logs the OTP to the server console instead of
 * sending a real SMS. NEVER used when SMS_PROVIDER is set to a real
 * gateway in production — see AppConfig.sms.provider.
 */
export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[dev-sms-stub] OTP for ${phone}: ${code} (would be sent via real SMS gateway in production)`);
    return Promise.resolve();
  }
}

/**
 * Thrown by a real provider when its call to the gateway fails (network
 * error, non-2xx response, or a gateway-reported failure status in an
 * otherwise-200 body — several Iranian SMS gateways, including
 * Kavenegar and Ghasedak, report business errors this way). The OTP
 * request flow (OtpService.requestOtp) lets this propagate as a 5xx
 * rather than silently reporting success, since a customer who never
 * receives their code and is told "sent" cannot self-diagnose the
 * failure or retry meaningfully.
 */
export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
  ) {
    super(message);
    this.name = "SmsDeliveryError";
  }
}

/** Strips the `+` prefix — both Kavenegar and Ghasedak expect a local/bare-98 form, not E.164 with a leading `+`. */
function toBareDigits(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}

/**
 * Kavenegar OTP delivery via their "Verify Lookup" endpoint, which is
 * built specifically for OTP-style templated sends (not a raw SMS body)
 * — this is the correct Kavenegar integration for a login code, not
 * their generic /sms/send.
 *
 * Required env: SMS_PROVIDER_API_KEY (Kavenegar API key).
 * Optional env: SMS_KAVENEGAR_TEMPLATE (Verify Lookup template name
 * configured in the Kavenegar panel; defaults to "verify" — an admin
 * must create a template with this name, with `%token%` as the single
 * placeholder, in their Kavenegar account before this works).
 */
export class KavenegarSmsProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly template: string = "verify",
  ) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`;
    const params = new URLSearchParams({
      receptor: toBareDigits(phone),
      token: code,
      template: this.template,
    });

    let res: Response;
    try {
      res = await fetch(`${url}?${params.toString()}`, { method: "GET" });
    } catch (err) {
      throw new SmsDeliveryError(`Kavenegar request failed: ${(err as Error).message}`, "kavenegar");
    }

    let body: { return?: { status?: number; message?: string } } | undefined;
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // Fall through — treated as failure below via !res.ok / missing status.
    }

    // Kavenegar reports success as HTTP 200 with return.status === 200;
    // some failure modes still return HTTP 200 with a different status
    // in the body, so both layers must be checked.
    if (!res.ok || body?.return?.status !== 200) {
      const detail = body?.return?.message ?? `HTTP ${res.status}`;
      throw new SmsDeliveryError(`Kavenegar OTP send failed: ${detail}`, "kavenegar");
    }
  }
}

/**
 * Ghasedak OTP delivery via their v2 "Verify" (OTP template) endpoint.
 *
 * Required env: SMS_PROVIDER_API_KEY (Ghasedak API key).
 * Optional env: SMS_GHASEDAK_TEMPLATE (template name configured in the
 * Ghasedak panel; defaults to "otp-code" — an admin must create a
 * matching template with a single `%code%` parameter before this works).
 */
export class GhasedakSmsProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly template: string = "otp-code",
  ) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch("https://api.ghasedak.me/v2/verification/send/simple", {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          receptor: toBareDigits(phone),
          type: "1",
          template: this.template,
          param1: code,
        }).toString(),
      });
    } catch (err) {
      throw new SmsDeliveryError(`Ghasedak request failed: ${(err as Error).message}`, "ghasedak");
    }

    let body: { result?: { code?: number; message?: string } } | undefined;
    try {
      body = (await res.json()) as typeof body;
    } catch {
      // Fall through — treated as failure below.
    }

    // Ghasedak reports success as result.code === 200.
    if (!res.ok || body?.result?.code !== 200) {
      const detail = body?.result?.message ?? `HTTP ${res.status}`;
      throw new SmsDeliveryError(`Ghasedak OTP send failed: ${detail}`, "ghasedak");
    }
  }
}

/**
 * Placeholder for any SMS_PROVIDER value that isn't "console" and isn't
 * one of the gateways implemented above. Intentionally fails loudly
 * rather than silently no-op-ing, so a typo'd or not-yet-supported
 * provider name is caught immediately instead of customers never
 * receiving OTP codes in production.
 */
export class UnconfiguredSmsProvider implements SmsProvider {
  constructor(private readonly providerName: string) {}

  async sendOtp(): Promise<void> {
    throw new Error(
      `SMS provider "${this.providerName}" is not yet implemented. Supported values for SMS_PROVIDER ` +
        `are: console, kavenegar, ghasedak. Add a new SmsProvider implementation in ` +
        `apps/api/src/auth/otp/sms-provider.ts to support another gateway.`,
    );
  }
}
