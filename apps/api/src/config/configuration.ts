export interface AppConfig {
  nodeEnv: string;
  appUrl: string;
  database: { url: string };
  redis: { url: string };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    publicBaseUrl: string;
  };
  otp: {
    hashSecret: string;
    ttlSeconds: number;
    maxAttempts: number;
    requestRateLimitPerHour: number;
  };
  session: {
    cookieName: string;
    renewalWindowDays: number;
    absoluteMaxDays: number;
    hashSecret: string;
  };
  guestCart: {
    cookieName: string;
    maxAgeDays: number;
  };
  adminSession: {
    cookieName: string;
    ttlHours: number;
  };
  sms: { provider: string; apiKey?: string };
  payment: {
    provider: string;
    merchantId?: string;
    callbackBaseUrl: string;
    cardToCard: { number?: string; holderName?: string };
    sheba: { iban?: string; holderName?: string };
  };
  shipping: {
    flatRateToman: number;
    freeThresholdToman?: number;
    freeEnabled: boolean;
  };
  inventory: { reservationTtlMinutes: number };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast at boot rather than surfacing a confusing error deep in a request.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  database: {
    url: required("DATABASE_URL"),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "junuban-media",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "http://localhost:9000/junuban-media",
  },
  otp: {
    hashSecret: process.env.OTP_HASH_SECRET ?? "dev-only-insecure-secret-change-me",
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    requestRateLimitPerHour: Number(process.env.OTP_REQUEST_RATE_LIMIT_PER_HOUR ?? 5),
  },
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME ?? "junuban_session",
    renewalWindowDays: Number(process.env.SESSION_RENEWAL_WINDOW_DAYS ?? 7),
    absoluteMaxDays: Number(process.env.SESSION_ABSOLUTE_MAX_DAYS ?? 30),
    hashSecret: process.env.SESSION_HASH_SECRET ?? "dev-only-insecure-secret-change-me",
  },
  guestCart: {
    cookieName: process.env.GUEST_CART_COOKIE_NAME ?? "junuban_guest_cart",
    maxAgeDays: Number(process.env.GUEST_CART_MAX_AGE_DAYS ?? 30),
  },
  adminSession: {
    cookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? "junuban_admin_session",
    ttlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 12),
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? "console",
    apiKey: process.env.SMS_PROVIDER_API_KEY,
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? "stub",
    merchantId: process.env.PAYMENT_PROVIDER_MERCHANT_ID,
    callbackBaseUrl:
      process.env.PAYMENT_CALLBACK_BASE_URL ?? "http://localhost:4000/api/v1/payments/callback",
    cardToCard: {
      number: process.env.CARD_TO_CARD_NUMBER,
      holderName: process.env.CARD_TO_CARD_HOLDER_NAME,
    },
    sheba: {
      iban: process.env.SHEBA_IBAN,
      holderName: process.env.SHEBA_HOLDER_NAME,
    },
  },
  shipping: {
    flatRateToman: Number(process.env.SHIPPING_FLAT_RATE_TOMAN ?? 350000),
    freeThresholdToman: process.env.SHIPPING_FREE_THRESHOLD_TOMAN
      ? Number(process.env.SHIPPING_FREE_THRESHOLD_TOMAN)
      : undefined,
    freeEnabled: (process.env.SHIPPING_FREE_ENABLED ?? "true") === "true",
  },
  inventory: {
    reservationTtlMinutes: Number(process.env.INVENTORY_RESERVATION_TTL_MINUTES ?? 15),
  },
});
