import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";
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
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  getProvider(method: SupportedPaymentMethod): PaymentProvider {
    const payment = this.config.get("payment", { infer: true });

    switch (method) {
      case "CARD_TO_CARD":
        return new ManualTransferPaymentProvider({
          label: "شماره کارت",
          number: payment.cardToCard.number,
          holderName: payment.cardToCard.holderName,
        });
      case "SHEBA":
        return new ManualTransferPaymentProvider({
          label: "شماره شبا",
          number: payment.sheba.iban,
          holderName: payment.sheba.holderName,
        });
      case "ONLINE":
      default:
        return new UnconfiguredOnlinePaymentProvider();
    }
  }
}
