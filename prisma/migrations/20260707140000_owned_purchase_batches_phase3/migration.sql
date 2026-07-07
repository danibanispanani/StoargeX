-- Phase 3: owned purchase batches use the new inventory model.
-- Additive only: legacy stock_items and stock_item_listings stay untouched.

ALTER TABLE "owned_stock_lots"
  ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "inventory_position_listings" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "inventory_position_id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,

  CONSTRAINT "inventory_position_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_position_listings_inventory_position_id_platform_id_key"
  ON "inventory_position_listings"("inventory_position_id", "platform_id");
CREATE INDEX "inventory_position_listings_organization_id_idx"
  ON "inventory_position_listings"("organization_id");
CREATE INDEX "inventory_position_listings_platform_id_idx"
  ON "inventory_position_listings"("platform_id");

ALTER TABLE "inventory_position_listings"
  ADD CONSTRAINT "inventory_position_listings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_position_listings"
  ADD CONSTRAINT "inventory_position_listings_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_position_listings"
  ADD CONSTRAINT "inventory_position_listings_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "platforms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_position_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_position_listings" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "inventory_position_listings"
  USING ("organization_id" = current_setting('app.current_org_id', TRUE))
  WITH CHECK ("organization_id" = current_setting('app.current_org_id', TRUE));

CREATE POLICY bypass_rls ON "inventory_position_listings"
  USING (current_setting('app.bypass_rls', TRUE) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', TRUE) = 'on');