import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateSiteSettingsDto } from "./dto/update-site-settings.dto";

/**
 * SiteSettings is a single-row table (enforced at the app layer, per
 * its own schema comment) with no seed row — a fresh install has zero
 * rows until the first write. `getOrCreate` is the one place that
 * bootstraps it, so every other read/write in this service (and the
 * public-facing payment-info lookup in PaymentProviderFactory) can
 * assume exactly one row exists rather than each needing its own
 * null-handling.
 */
@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate() {
    const existing = await this.prisma.siteSettings.findFirst({ include: { paymentCardPhoto: true } });
    if (existing) return existing;

    // contactEmail/contactPhone/flatShippingRate have no default in the
    // schema (they're required, real store info) — an empty string is
    // an honest placeholder for "not configured yet" until the (not yet
    // built) general store-settings admin screen sets real values, and
    // is never displayed to customers by anything this cycle adds.
    return this.prisma.siteSettings.create({
      data: { contactEmail: "", contactPhone: "", flatShippingRate: 0 },
      include: { paymentCardPhoto: true },
    });
  }

  async getPaymentSettings() {
    const settings = await this.getOrCreate();
    return {
      cardToCardNumber: settings.cardToCardNumber,
      cardToCardHolderName: settings.cardToCardHolderName,
      cardToCardBankName: settings.cardToCardBankName,
      shebaIban: settings.shebaIban,
      shebaHolderName: settings.shebaHolderName,
      paymentInstructions: settings.paymentInstructions,
      paymentCardPhoto: settings.paymentCardPhoto
        ? { url: settings.paymentCardPhoto.url, altText: settings.paymentCardPhoto.altText }
        : null,
    };
  }

  async updatePaymentSettings(dto: UpdateSiteSettingsDto) {
    const settings = await this.getOrCreate();

    // Same 1:1-relation three-state contract as Producer.photo/
    // Category.photo (see SinglePhotoInputDto's doc comment): undefined
    // = leave unchanged, null = remove, object = upsert.
    const photoWrite =
      dto.paymentCardPhoto === undefined
        ? {}
        : dto.paymentCardPhoto === null
          ? { paymentCardPhoto: { delete: true } }
          : {
              paymentCardPhoto: {
                upsert: {
                  create: { url: dto.paymentCardPhoto.url, altText: dto.paymentCardPhoto.altText },
                  update: { url: dto.paymentCardPhoto.url, altText: dto.paymentCardPhoto.altText },
                },
              },
            };

    const updated = await this.prisma.siteSettings.update({
      where: { id: settings.id },
      data: {
        cardToCardNumber: dto.cardToCardNumber,
        cardToCardHolderName: dto.cardToCardHolderName,
        cardToCardBankName: dto.cardToCardBankName,
        shebaIban: dto.shebaIban,
        shebaHolderName: dto.shebaHolderName,
        paymentInstructions: dto.paymentInstructions,
        ...photoWrite,
      },
      include: { paymentCardPhoto: true },
    });

    return {
      cardToCardNumber: updated.cardToCardNumber,
      cardToCardHolderName: updated.cardToCardHolderName,
      cardToCardBankName: updated.cardToCardBankName,
      shebaIban: updated.shebaIban,
      shebaHolderName: updated.shebaHolderName,
      paymentInstructions: updated.paymentInstructions,
      paymentCardPhoto: updated.paymentCardPhoto
        ? { url: updated.paymentCardPhoto.url, altText: updated.paymentCardPhoto.altText }
        : null,
    };
  }
}
