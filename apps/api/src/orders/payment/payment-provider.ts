import { formatTomanForBackend } from "../money.util";

export interface PaymentInitiationResult {
  /** Present for redirect-based gateways (ONLINE). Absent for manual methods (CARD_TO_CARD/SHEBA). */
  redirectUrl?: string;
  /** Opaque reference from the provider, stored on PaymentAttempt.providerRef. */
  providerRef?: string;
  /** Instructions to show the customer for manual-confirmation methods. */
  instructions?: string;
  /**
   * Structured card/Sheba display info for CARD_TO_CARD/SHEBA — kept
   * separate from `instructions` (a single prose string) so the
   * frontend can render number/holder/bank/image as distinct, clearly
   * separated UI elements (see the master prompt's explicit ask to
   * avoid one merged paragraph) instead of parsing them back out of
   * free text, which would be fragile and would break the moment the
   * Persian wording of `instructions` changes.
   */
  cardDisplay?: {
    number: string;
    holderName: string | null;
    bankName: string | null;
    photo: { url: string; altText: string } | null;
    /** Admin's own free-text notes (SiteSettings.paymentInstructions) — kept separate from the auto-generated `instructions` string above, not appended into it, so the frontend can render them as visually distinct blocks. */
    adminNotes: string | null;
  };
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
    private readonly destination: {
      label: string;
      number?: string;
      holderName?: string;
      bankName?: string;
      photo?: { url: string; altText: string } | null;
      adminNotes?: string | null;
    },
  ) {}

  async initiate(input: { amount: number }): Promise<PaymentInitiationResult> {
    const amountText = formatTomanForBackend(input.amount);
    const instructions = this.destination.number
      ? `مبلغ ${amountText} تومان را به ${this.destination.label} ${this.destination.number} به نام ${this.destination.holderName ?? ""} واریز کنید و رسید را نزد خود نگه دارید.`
      : `اطلاعات ${this.destination.label} هنوز توسط فروشگاه تنظیم نشده است. مبلغ قابل پرداخت: ${amountText} تومان.`;

    return Promise.resolve({
      instructions,
      cardDisplay: this.destination.number
        ? {
            number: this.destination.number,
            holderName: this.destination.holderName ?? null,
            bankName: this.destination.bankName ?? null,
            photo: this.destination.photo ?? null,
            adminNotes: this.destination.adminNotes ?? null,
          }
        : undefined,
    });
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
