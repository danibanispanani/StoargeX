-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockItemStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "StockItemStatus" ADD VALUE 'IN_TRANSIT';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "order_id_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "order_id_format" TEXT NOT NULL DEFAULT 'SX-{JJJJ}-{NR:4}';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "buyer_country" TEXT NOT NULL DEFAULT 'DE',
ADD COLUMN     "fees_booked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoice_created" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "margin_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payout_recipient" TEXT,
ADD COLUMN     "postage_booked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profit_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sale_net_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipping_method" TEXT,
ADD COLUMN     "tax_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "consignment_ref_id" TEXT,
ADD COLUMN     "ean" TEXT,
ADD COLUMN     "input_tax_deductible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "purchase_net_cents" INTEGER,
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "variant" TEXT;

-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN     "country" TEXT;

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "base_cents" INTEGER NOT NULL,
    "per_kg_cents" INTEGER NOT NULL DEFAULT 0,
    "max_weight_kg" DECIMAL(6,2),
    "surcharges" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_item_listings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_item_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_rates_organization_id_idx" ON "shipping_rates"("organization_id");

-- CreateIndex
CREATE INDEX "shipping_rates_organization_id_active_idx" ON "shipping_rates"("organization_id", "active");

-- CreateIndex
CREATE INDEX "stock_item_listings_organization_id_idx" ON "stock_item_listings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_item_listings_stock_item_id_platform_id_key" ON "stock_item_listings"("stock_item_id", "platform_id");

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_listings" ADD CONSTRAINT "stock_item_listings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_listings" ADD CONSTRAINT "stock_item_listings_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_listings" ADD CONSTRAINT "stock_item_listings_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security für die neuen Tenant-Tabellen (gleiches Muster wie Init-Migration)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shipping_rates', 'stock_item_listings']
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
