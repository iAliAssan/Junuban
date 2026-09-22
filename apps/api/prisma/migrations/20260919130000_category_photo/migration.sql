-- AlterTable
-- Mirrors the existing "media_producer_id" pattern exactly (same
-- nullable, unique, cascading-delete 1:1 relation shape) — see
-- 20260915183740_init/migration.sql for the producer_id column this is
-- modeled after. Nullable and additive: every existing media row gets
-- NULL here, meaning "not a category photo", which is correct for
-- every row that existed before this feature.
ALTER TABLE "media" ADD COLUMN "category_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "media_category_id_key" ON "media"("category_id");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
