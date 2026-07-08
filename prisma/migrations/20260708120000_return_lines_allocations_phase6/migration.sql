-- Phase 6: relational, quantity-based returns.
-- Additive only: legacy Return fields stay in place.

ALTER TABLE "returns"
  ADD COLUMN "return_number" TEXT;

CREATE UNIQUE INDEX "returns_organization_id_return_number_key"
  ON "returns"("organization_id", "return_number");

CREATE TABLE "return_lines" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "return_id" TEXT NOT NULL,
  "sale_line_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "problem_type" TEXT,
  "condition" TEXT,
  "refund_amount_cents" INTEGER,
  "extra_costs_cents" INTEGER,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_allocations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "return_line_id" TEXT NOT NULL,
  "sale_line_allocation_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "receipt_movement_id" TEXT,
  "restock_movement_id" TEXT,
  "defective_movement_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "return_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "return_lines_organization_id_idx"
  ON "return_lines"("organization_id");
CREATE INDEX "return_lines_return_id_idx"
  ON "return_lines"("return_id");
CREATE INDEX "return_lines_sale_line_id_idx"
  ON "return_lines"("sale_line_id");

CREATE INDEX "return_allocations_organization_id_idx"
  ON "return_allocations"("organization_id");
CREATE INDEX "return_allocations_return_line_id_idx"
  ON "return_allocations"("return_line_id");
CREATE INDEX "return_allocations_sale_line_allocation_id_idx"
  ON "return_allocations"("sale_line_allocation_id");

ALTER TABLE "return_lines"
  ADD CONSTRAINT "return_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_lines"
  ADD CONSTRAINT "return_lines_return_id_fkey"
  FOREIGN KEY ("return_id") REFERENCES "returns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_lines"
  ADD CONSTRAINT "return_lines_sale_line_id_fkey"
  FOREIGN KEY ("sale_line_id") REFERENCES "sale_lines"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_allocations"
  ADD CONSTRAINT "return_allocations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_allocations"
  ADD CONSTRAINT "return_allocations_return_line_id_fkey"
  FOREIGN KEY ("return_line_id") REFERENCES "return_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "return_allocations"
  ADD CONSTRAINT "return_allocations_sale_line_allocation_id_fkey"
  FOREIGN KEY ("sale_line_allocation_id") REFERENCES "sale_line_allocations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_lines"
  ADD CONSTRAINT "return_lines_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "return_allocations"
  ADD CONSTRAINT "return_allocations_quantity_positive" CHECK ("quantity" > 0);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'return_lines',
    'return_allocations'
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
