import { formatTomanForBackend } from "../money.util";

export interface PaymentInitiationResult {
  /** Present for redirect-based gateways (ONLINE). Absent for manual methods (CARD_TO_CARD/SHEBA). */
  redirectUrl?: string;
  /** Opaque reference from the provider, stored on PaymentAttempt.providerRef. */
  providerRef?: string;
  /** Instructions to show the customer for manual-confirmation methods. */
  instructions?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  message?: string;
}

/**
 * Abstraction a real Iranian payment gateway (e.g. ZarinPal, IDPay) would
 * implement later. NOT implemented for the ONLINE method this cycle —
 * see UnconfiguredOnlinePaymentProvider below. CARD_TO_CARD and SHEBA are
 * real, functioning flows that don't need a gateway at all: they require
 * manual confirmation, which is a legitimate payment method in its own
 * right, not a stand-in for one.
 */
export interface PaymentProvider {
  initiate(input: { orderId: string; amount: number; idempotencyKey: string }): Promise<PaymentInitiationResult>;
  verify(providerRef: string): Promise<PaymentVerificationResult>;
}

/**
 * CARD_TO_CARD / SHEBA: there is no gateway to call. "Initiating" payment
 * just means presenting the destination account details already
 * configured in .env, along with the exact amount to transfer — confirmation
 * happens later via OrdersService.confirmManualPayment (an admin action —
 * see IMPLEMENTATION_STATUS.md for why the admin-facing endpoint itself
 * is out of scope this cycle, not the underlying domain logic).
 */
export class ManualTransferPaymentProvider implements PaymentProvider {
  constructor(
    private readonly destination: { label: string; number?: string; holderName?: string },
  ) {}

  async initiate(input: { amount: number }): Promise<PaymentInitiationResult> {
    const amountText = formatTomanForBackend(input.amount);
    const instructions = this.destination.number
      ? `مبلغ ${amountText} تومان را به ${this.destination.label} ${this.destination.number} به نام ${this.destination.holderName ?? ""} واریز کنید و رسید را نزد خود نگه دارید.`
      : `اطلاعات ${this.destination.label} هنوز توسط فروشگاه تنظیم نشده است. مبلغ قابل پرداخت: ${amountText} تومان.`;
    return Promise.resolve({ instructions });
  }

  async verify(): Promise<PaymentVerificationResult> {
    // Manual methods are never auto-verified — an admin must confirm
    // them (see OrdersService.confirmManualPayment). Calling verify()
    // on a manual method is a programming error, not a real gateway
    // check, so it deliberately never reports success.
    return Promise.resolve({ success: false, message: "این روش پرداخت نیازمند تایید دستی است" });
  }
}

/**
 * ONLINE (a real redirect-based gateway) is intentionally NOT
 * implemented — see IMPLEMENTATION_STATUS.md. Never claims success;
 * fails loudly and clearly rather than faking a working gateway.
 */
export class UnconfiguredOnlinePaymentProvider implements PaymentProvider {
  async initiate(): Promise<PaymentInitiationResult> {
    throw new Error(
      "درگاه پرداخت آنلاین هنوز متصل نشده است. لطفاً از روش کارت‌به‌کارت یا شبا استفاده کنید.",
    );
  }

  async verify(): Promise<PaymentVerificationResult> {
    throw new Error("درگاه پرداخت آنلاین هنوز متصل نشده است.");
  }
}
