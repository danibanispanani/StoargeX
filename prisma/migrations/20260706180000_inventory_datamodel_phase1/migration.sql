-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('OWNED_STOCK', 'CONSIGNMENT', 'PURCHASE', 'SALE', 'RETURN', 'DEBT');

-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('OWNED', 'CONSIGNMENT');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchase_number" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "purchase_status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "comment" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_gross" DECIMAL(12,2) NOT NULL,
    "unit_price_net" DECIMAL(12,2) NOT NULL,
    "vat_deductible" BOOLEAN NOT NULL DEFAULT false,
    "total_gross" DECIMAL(12,2) NOT NULL,
    "total_net" DECIMAL(12,2) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_positions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "inventory_type" "InventoryType" NOT NULL,
    "inventory_number" TEXT NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "quantity_available" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "quantity_inspection" INTEGER NOT NULL DEFAULT 0,
    "quantity_defective" INTEGER NOT NULL DEFAULT 0,
    "quantity_sold" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_stock_lots" (
    "id" TEXT NOT NULL,
    "inventory_position_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purchase_line_id" TEXT,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT NOT NULL,
    "unit_price_gross" DECIMAL(12,2) NOT NULL,
    "unit_price_net" DECIMAL(12,2) NOT NULL,
    "vat_deductible" BOOLEAN NOT NULL DEFAULT false,
    "payment_method" TEXT NOT NULL,
    "purchase_entry_status" "EntryStatus" NOT NULL DEFAULT 'O',
    "return_entry_status" "EntryStatus" NOT NULL DEFAULT 'NN',
    "ean" TEXT,
    "legacy_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owned_stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignment_lots" (
    "id" TEXT NOT NULL,
    "inventory_position_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "partner_company" TEXT NOT NULL,
    "external_sku" TEXT,
    "identification_number" TEXT,
    "cost_gross" DECIMAL(12,2),
    "cost_net" DECIMAL(12,2),
    "settlement_amount" DECIMAL(12,2),
    "shipping_cost" DECIMAL(12,2),
    "channel_prices" JSONB NOT NULL DEFAULT '[]',
    "comment" TEXT,
    "legacy_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignment_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_sequences_organization_id_idx" ON "document_sequences"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_organization_id_kind_year_key" ON "document_sequences"("organization_id", "kind", "year");

-- CreateIndex
CREATE INDEX "purchases_organization_id_idx" ON "purchases"("organization_id");

-- CreateIndex
CREATE INDEX "purchases_organization_id_purchase_date_idx" ON "purchases"("organization_id", "purchase_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_organization_id_purchase_number_key" ON "purchases"("organization_id", "purchase_number");

-- CreateIndex
CREATE INDEX "purchase_lines_organization_id_idx" ON "purchase_lines"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_lines_purchase_id_idx" ON "purchase_lines"("purchase_id");

-- CreateIndex
CREATE INDEX "inventory_positions_organization_id_idx" ON "inventory_positions"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_positions_organization_id_inventory_type_idx" ON "inventory_positions"("organization_id", "inventory_type");

-- CreateIndex
CREATE INDEX "inventory_positions_organization_id_active_idx" ON "inventory_positions"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_positions_organization_id_inventory_number_key" ON "inventory_positions"("organization_id", "inventory_number");

-- CreateIndex
CREATE UNIQUE INDEX "owned_stock_lots_inventory_position_id_key" ON "owned_stock_lots"("inventory_position_id");

-- CreateIndex
CREATE INDEX "owned_stock_lots_organization_id_idx" ON "owned_stock_lots"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "consignment_lots_inventory_position_id_key" ON "consignment_lots"("inventory_position_id");

-- CreateIndex
CREATE INDEX "consignment_lots_organization_id_idx" ON "consignment_lots"("organization_id");

-- CreateIndex
CREATE INDEX "consignment_lots_organization_id_partner_company_idx" ON "consignment_lots"("organization_id", "partner_company");

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_positions" ADD CONSTRAINT "inventory_positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_positions" ADD CONSTRAINT "inventory_positions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_stock_lots" ADD CONSTRAINT "owned_stock_lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_stock_lots" ADD CONSTRAINT "owned_stock_lots_inventory_position_id_fkey" FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_stock_lots" ADD CONSTRAINT "owned_stock_lots_purchase_line_id_fkey" FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_lots" ADD CONSTRAINT "consignment_lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_lots" ADD CONSTRAINT "consignment_lots_inventory_position_id_fkey" FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Phase 1 Ergaenzungen: CHECK-Constraints und Row Level Security
-- Bestehende Tabellen bleiben unangetastet (additive Phase).
-- ============================================================================

-- Nicht-negative Mengen (Datenintegritaet auf DB-Ebene)
ALTER TABLE "inventory_positions"
  ADD CONSTRAINT "inventory_positions_qty_nonneg" CHECK (
    "quantity_received"   >= 0 AND
    "quantity_available"  >= 0 AND
    "quantity_reserved"   >= 0 AND
    "quantity_inspection" >= 0 AND
    "quantity_defective"  >= 0 AND
    "quantity_sold"       >= 0
  );

-- Nicht-negative Mengen fuer Purchase-Positionen
ALTER TABLE "purchase_lines"
  ADD CONSTRAINT "purchase_lines_qty_positive" CHECK ("quantity" > 0);

-- Row Level Security fuer alle neuen Tenant-Tabellen (Muster wie Init-Migration)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_sequences',
    'purchases',
    'purchase_lines',
    'inventory_positions',
    'owned_stock_lots',
    'consignment_lots'
  ]
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
