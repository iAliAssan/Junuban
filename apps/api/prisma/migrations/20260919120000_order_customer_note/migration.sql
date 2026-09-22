-- AlterTable
-- Adds a nullable column to an existing table with no default value
-- expression that touches existing rows — safe, additive, no data loss.
-- Every existing order row gets NULL for this column, which is exactly
-- the correct value for "this order was placed before this field
-- existed" (see the Prisma schema's doc comment on Order.customerNote).
ALTER TABLE "orders" ADD COLUMN "customer_note" TEXT;
