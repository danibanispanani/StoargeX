-- Phase 5: Sale lines and inventory allocations.
-- Additive only: legacy SaleItem remains for old sales.

CREATE TABLE "sale_lines" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "description_snapshot" TEXT NOT NULL,
  "variant_snapshot" TEXT,
  "size_snapshot" TEXT,
  "quantity" INTEGER NOT NULL,
  "unit_gross_price" DECIMAL(12, 2) NOT NULL,
  "gross_amount" DECIMAL(12, 2) NOT NULL,
  "net_amount" DECIMAL(12, 2) NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_line_allocations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "sale_line_id" TEXT NOT NULL,
  "inventory_position_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_cost_net_snapshot" DECIMAL(12, 2) NOT NULL,
  "inventory_type_snapshot" "InventoryType" NOT NULL,
  "consignment_settlement_snapshot" DECIMAL(12, 2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sale_line_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_lines_organization_id_idx"
  ON "sale_lines"("organization_id");
CREATE INDEX "sale_lines_sale_id_idx"
  ON "sale_lines"("sale_id");
CREATE INDEX "sale_lines_product_id_idx"
  ON "sale_lines"("product_id");

CREATE INDEX "sale_line_allocations_organization_id_idx"
  ON "sale_line_allocations"("organization_id");
CREATE INDEX "sale_line_allocations_sale_line_id_idx"
  ON "sale_line_allocations"("sale_line_id");
CREATE INDEX "sale_line_allocations_inventory_position_id_idx"
  ON "sale_line_allocations"("inventory_position_id");

ALTER TABLE "sale_lines"
  ADD CONSTRAINT "sale_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_lines"
  ADD CONSTRAINT "sale_lines_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_lines"
  ADD CONSTRAINT "sale_lines_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_line_allocations"
  ADD CONSTRAINT "sale_line_allocations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_line_allocations"
  ADD CONSTRAINT "sale_line_allocations_sale_line_id_fkey"
  FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sale_line_allocations"
  ADD CONSTRAINT "sale_line_allocations_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_lines"
  ADD CONSTRAINT "sale_lines_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "sale_line_allocations"
  ADD CONSTRAINT "sale_line_allocations_quantity_positive" CHECK ("quantity" > 0);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sale_lines',
    'sale_line_allocations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $p$CREATE POLICY tenant_isolation ON %I
         USING ("organization_id" = current_setting('app.current_org_id', TRUE))
         WITH CHECK ("organization_id" = current_setting('app.current_org_id', TRUE))$p$,
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
