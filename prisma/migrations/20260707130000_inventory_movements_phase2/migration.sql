-- Phase 2: Inventory movements and centralized stock history.
-- Additive only: no legacy tables or fields are removed.

CREATE TYPE "InventoryBucket" AS ENUM ('AVAILABLE', 'RESERVED', 'INSPECTION', 'DEFECTIVE');

CREATE TYPE "InventoryMovementType" AS ENUM (
  'PURCHASE_RECEIPT',
  'CONSIGNMENT_RECEIPT',
  'SALE_OUT',
  'RESERVE',
  'RELEASE_RESERVATION',
  'RETURN_RECEIPT',
  'RETURN_RESTOCK',
  'RETURN_DEFECTIVE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'REVERSAL'
);

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "inventory_position_id" TEXT NOT NULL,
  "movement_type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "from_bucket" "InventoryBucket",
  "to_bucket" "InventoryBucket",
  "reference_type" TEXT,
  "reference_id" TEXT,
  "reference_action" TEXT,
  "idempotency_key" TEXT,
  "comment" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_movements_organization_id_idempotency_key_key"
  ON "inventory_movements"("organization_id", "idempotency_key");
CREATE INDEX "inventory_movements_organization_id_idx"
  ON "inventory_movements"("organization_id");
CREATE INDEX "inventory_movements_organization_id_inventory_position_id_created_at_idx"
  ON "inventory_movements"("organization_id", "inventory_position_id", "created_at");
CREATE INDEX "inventory_movements_organization_id_reference_type_reference_id_idx"
  ON "inventory_movements"("organization_id", "reference_type", "reference_id");
CREATE INDEX "inventory_movements_created_by_id_idx"
  ON "inventory_movements"("created_by_id");

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "inventory_movements"
  USING ("organization_id" = current_setting('app.current_org_id', TRUE))
  WITH CHECK ("organization_id" = current_setting('app.current_org_id', TRUE));

CREATE POLICY bypass_rls ON "inventory_movements"
  USING (current_setting('app.bypass_rls', TRUE) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', TRUE) = 'on');