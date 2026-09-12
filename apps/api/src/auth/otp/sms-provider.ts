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
 * Placeholder for a real provider (e.g. Kavenegar, Ghasedak, Melipayamak).
 * Intentionally left unimplemented — wiring in real credentials and a
 * real HTTP call is a genuine external-provider integration task that
 * must not be faked. See SMS_PROVIDER_API_KEY in .env.example.
 */
export class UnconfiguredSmsProvider implements SmsProvider {
  constructor(private readonly providerName: string) {}

  async sendOtp(): Promise<void> {
    throw new Error(
      `SMS provider "${this.providerName}" is not yet implemented. Configure a real gateway ` +
        `integration in apps/api/src/auth/otp/sms-provider.ts before using SMS_PROVIDER=${this.providerName} outside development.`,
    );
  }
}
