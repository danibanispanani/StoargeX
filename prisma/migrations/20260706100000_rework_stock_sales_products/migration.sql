-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('E', 'O', 'NN', 'S');

-- CreateEnum
CREATE TYPE "OptionKind" AS ENUM ('PAYMENT_METHOD', 'PAYOUT_RECIPIENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockItemStatus" ADD VALUE 'STORED_R';
ALTER TYPE "StockItemStatus" ADD VALUE 'STORED_D';
ALTER TYPE "StockItemStatus" ADD VALUE 'OTHER';

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_stock_item_id_fkey";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "stock_id_counter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "fee_incl_vat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "platform_fee_net_cents" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "stock_item_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_items" DROP COLUMN "consignment_ref_id",
ADD COLUMN     "kauf_status" "EntryStatus" NOT NULL DEFAULT 'O',
ADD COLUMN     "retoure_status" "EntryStatus" NOT NULL DEFAULT 'NN';

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "stock_item_id" TEXT,
    "consignment_id" TEXT,
    "ek_net_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "select_options" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "OptionKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "select_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "category" TEXT,
    "ean" TEXT,
    "default_price_cents" INTEGER,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_items_organization_id_idx" ON "sale_items"("organization_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "select_options_organization_id_idx" ON "select_options"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "select_options_organization_id_kind_label_key" ON "select_options"("organization_id", "kind", "label");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_name_variant_key" ON "products"("organization_id", "name", "variant");

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_consignment_id_fkey" FOREIGN KEY ("consignment_id") REFERENCES "consignment_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "select_options" ADD CONSTRAINT "select_options_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Datenmigration
-- ============================================================================

-- Alt-Status auf die neuen Werte mappen (LISTED/RESERVED -> gelagert)
UPDATE "stock_items" SET "status" = 'IN_STOCK' WHERE "status" IN ('LISTED', 'RESERVED');

-- Bestehende Verkaeufe in sale_items ueberfuehren (1 Verkauf = 1 Position)
INSERT INTO "sale_items" ("id", "organization_id", "sale_id", "stock_item_id", "ek_net_cents")
SELECT 'si_' || md5(random()::text || s."id"), s."organization_id", s."id", s."stock_item_id",
       COALESCE(s."sale_net_cents" - s."margin_cents", 0)
FROM "sales" s
WHERE s."stock_item_id" IS NOT NULL;

-- Zahlungsgebuehren in Plattformgebuehren aufgehen lassen, Netto berechnen
UPDATE "sales" SET
  "platform_fee_cents" = "platform_fee_cents" + "payment_fee_cents",
  "payment_fee_cents" = 0;
UPDATE "sales" SET
  "platform_fee_net_cents" = ROUND("platform_fee_cents" / 1.19);

-- ============================================================================
-- Row Level Security fuer die neuen Tenant-Tabellen
-- ============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sale_items', 'select_options', 'products']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $p$CREATE POLICY tenant_isolation ON %I
         USING ("organization_id" = current_setting('app.current_org_id', TRUE))$p$,
      t
    );
    EXECUTE format(
      $p$CREATE POLICY bypass_rls ON %I
         USING (current_setting('app.bypass_rls', TRUE) = 'on')
         WITH CHECK (current_setting('app.bypass_rls', TRUE) = 'on')$p$,
      t
    );
  END LOOP;
END $$;
