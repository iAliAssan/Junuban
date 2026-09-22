-- AlterTable
-- All-nullable additive columns — a fresh/existing SiteSettings row
-- gets NULL for every one of these, which correctly means "no manual
-- payment info configured yet" (see the schema's doc comment on
-- SiteSettings.cardToCardNumber for why the checkout flow must treat
-- that as a real, honestly-handled state rather than assume it's
-- always configured).
ALTER TABLE "site_settings" ADD COLUMN "card_to_card_number" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "card_to_card_holder_name" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "card_to_card_bank_name" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "sheba_iban" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "sheba_holder_name" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "payment_instructions" TEXT;

-- AlterTable
-- Same nullable/unique/cascading 1:1 pattern as media.producer_id and
-- media.category_id (see those migrations) — one optional card-image
-- Media row per SiteSettings row.
ALTER TABLE "media" ADD COLUMN "site_settings_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "media_site_settings_id_key" ON "media"("site_settings_id");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_site_settings_id_fkey" FOREIGN KEY ("site_settings_id") REFERENCES "site_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
