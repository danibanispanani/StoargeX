-- Additive procurement and inbound-receipt foundation.
-- Existing Purchase/PurchaseLine/Lot/Movement rows remain valid and untouched.

ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'ORDERED';
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "ImportTargetEntity" ADD VALUE IF NOT EXISTS 'PURCHASE_RECEIPT';

CREATE TYPE "PurchaseShippingStatus" AS ENUM (
  'NOT_SHIPPED',
  'READY',
  'SHIPPED',
  'PARTIALLY_RECEIVED',
  'DELIVERED',
  'UNKNOWN'
);

CREATE TYPE "ReceiptInspectionStatus" AS ENUM ('PENDING', 'PASSED', 'DEFECTIVE');

ALTER TABLE "purchases"
  ADD COLUMN "supplier_order_number" TEXT,
  ADD COLUMN "expected_delivery_at" TIMESTAMP(3),
  ADD COLUMN "received_at" TIMESTAMP(3),
  ADD COLUMN "shipping_carrier" TEXT,
  ADD COLUMN "tracking_number" TEXT,
  ADD COLUMN "shipping_status" "PurchaseShippingStatus" NOT NULL DEFAULT 'NOT_SHIPPED',
  ADD COLUMN "return_deadline" TIMESTAMP(3),
  ADD COLUMN "document_reference" TEXT;

CREATE TABLE "purchase_receipts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "purchase_id" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL,
  "shipping_carrier" TEXT,
  "tracking_number" TEXT,
  "document_reference" TEXT,
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_receipt_lines" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "purchase_receipt_id" TEXT NOT NULL,
  "purchase_line_id" TEXT NOT NULL,
  "inventory_position_id" TEXT NOT NULL,
  "inbound_movement_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "item_condition" "ItemCondition",
  "legacy_condition" TEXT,
  "inspection_status" "ReceiptInspectionStatus" NOT NULL DEFAULT 'PASSED',
  "return_deadline" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_receipt_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_receipt_lines_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "purchases_organization_id_purchase_status_idx"
  ON "purchases"("organization_id", "purchase_status");
CREATE INDEX "purchases_organization_id_shipping_status_idx"
  ON "purchases"("organization_id", "shipping_status");
CREATE INDEX "purchases_organization_id_return_deadline_idx"
  ON "purchases"("organization_id", "return_deadline");
CREATE INDEX "purchase_receipts_organization_id_idx"
  ON "purchase_receipts"("organization_id");
CREATE INDEX "purchase_receipts_organization_id_received_at_idx"
  ON "purchase_receipts"("organization_id", "received_at");
CREATE INDEX "purchase_receipts_purchase_id_idx"
  ON "purchase_receipts"("purchase_id");
CREATE INDEX "purchase_receipts_created_by_id_idx"
  ON "purchase_receipts"("created_by_id");
CREATE UNIQUE INDEX "purchase_receipt_lines_inventory_position_id_key"
  ON "purchase_receipt_lines"("inventory_position_id");
CREATE UNIQUE INDEX "purchase_receipt_lines_inbound_movement_id_key"
  ON "purchase_receipt_lines"("inbound_movement_id");
CREATE INDEX "purchase_receipt_lines_organization_id_idx"
  ON "purchase_receipt_lines"("organization_id");
CREATE INDEX "purchase_receipt_lines_purchase_receipt_id_idx"
  ON "purchase_receipt_lines"("purchase_receipt_id");
CREATE INDEX "purchase_receipt_lines_purchase_line_id_idx"
  ON "purchase_receipt_lines"("purchase_line_id");
CREATE INDEX "purchase_receipt_lines_organization_id_return_deadline_idx"
  ON "purchase_receipt_lines"("organization_id", "return_deadline");

ALTER TABLE "purchase_receipts"
  ADD CONSTRAINT "purchase_receipts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipts_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_receipt_lines"
  ADD CONSTRAINT "purchase_receipt_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipt_lines_purchase_receipt_id_fkey"
  FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipt_lines_purchase_line_id_fkey"
  FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipt_lines_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_receipt_lines_inbound_movement_id_fkey"
  FOREIGN KEY ("inbound_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "purchase_receipts_tenant_policy" ON "purchase_receipts"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
CREATE POLICY "purchase_receipts_bypass_policy" ON "purchase_receipts"
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "purchase_receipt_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_receipt_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "purchase_receipt_lines_tenant_policy" ON "purchase_receipt_lines"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
CREATE POLICY "purchase_receipt_lines_bypass_policy" ON "purchase_receipt_lines"
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');
