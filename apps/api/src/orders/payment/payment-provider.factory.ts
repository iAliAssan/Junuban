import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ManualTransferPaymentProvider,
  UnconfiguredOnlinePaymentProvider,
  type PaymentProvider,
} from "./payment-provider";

export type SupportedPaymentMethod = "ONLINE" | "CARD_TO_CARD" | "SHEBA";

/** Payment methods actually offered at checkout this cycle — ONLINE is excluded until a real gateway is connected (see IMPLEMENTATION_STATUS.md). */
export const CHECKOUT_AVAILABLE_PAYMENT_METHODS: SupportedPaymentMethod[] = ["CARD_TO_CARD", "SHEBA"];

@Injectable()
export class PaymentProviderFactory {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Card-to-card/Sheba destination details now come from the
   * admin-editable SiteSettings row (see AdminSettingsService), not
   * CARD_TO_CARD_NUMBER/SHEBA_IBAN env vars — those env vars are
   * removed from configuration.ts entirely (see that file's own note)
   * rather than kept as a fallback, since a silent fallback to
   * old/unrelated env-var values would be a worse failure mode than
   * "not configured yet" (which ManualTransferPaymentProvider already
   * handles honestly — see its own doc comment).
   */
  async getProvider(method: SupportedPaymentMethod): Promise<PaymentProvider> {
    switch (method) {
      case "CARD_TO_CARD": {
        const settings = await this.prisma.siteSettings.findFirst({ include: { paymentCardPhoto: true } });
        return new ManualTransferPaymentProvider({
          label: "شماره کارت",
          number: settings?.cardToCardNumber ?? undefined,
          holderName: settings?.cardToCardHolderName ?? undefined,
          bankName: settings?.cardToCardBankName ?? undefined,
          photo: settings?.paymentCardPhoto
            ? { url: settings.paymentCardPhoto.url, altText: settings.paymentCardPhoto.altText }
            : null,
          adminNotes: settings?.paymentInstructions ?? null,
        });
      }
      case "SHEBA": {
        const settings = await this.prisma.siteSettings.findFirst({ include: { paymentCardPhoto: true } });
        return new ManualTransferPaymentProvider({
          label: "شماره شبا",
          number: settings?.shebaIban ?? undefined,
          holderName: settings?.shebaHolderName ?? undefined,
          // Sheba transfers aren't tied to a specific bank card image —
          // the uploaded card photo (item #21) is specifically for the
          // card-to-card destination, not shown for Sheba.
          photo: null,
          adminNotes: settings?.paymentInstructions ?? null,
        });
      }
      case "ONLINE":
      default:
        return new UnconfiguredOnlinePaymentProvider();
    }
  }
}
