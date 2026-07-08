-- Phase 7: relational debts and automated source links.
CREATE TYPE "DebtType" AS ENUM ('PURCHASE', 'SALE', 'MANUAL', 'OTHER');

ALTER TABLE "debts"
  ADD COLUMN "debt_number" TEXT,
  ADD COLUMN "debt_type" "DebtType" NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX "debts_organization_id_debt_number_key"
  ON "debts"("organization_id", "debt_number");

CREATE INDEX "debts_organization_id_debt_type_idx"
  ON "debts"("organization_id", "debt_type");

CREATE TABLE "debt_purchase_links" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "debt_id" TEXT NOT NULL,
  "purchase_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_purchase_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debt_sale_links" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "debt_id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_sale_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debt_inventory_links" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "debt_id" TEXT NOT NULL,
  "inventory_position_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_inventory_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debt_purchase_links_debt_id_key"
  ON "debt_purchase_links"("debt_id");
CREATE UNIQUE INDEX "debt_purchase_links_purchase_id_key"
  ON "debt_purchase_links"("purchase_id");
CREATE INDEX "debt_purchase_links_organization_id_idx"
  ON "debt_purchase_links"("organization_id");
CREATE INDEX "debt_purchase_links_organization_id_purchase_id_idx"
  ON "debt_purchase_links"("organization_id", "purchase_id");

CREATE UNIQUE INDEX "debt_sale_links_debt_id_key"
  ON "debt_sale_links"("debt_id");
CREATE UNIQUE INDEX "debt_sale_links_sale_id_key"
  ON "debt_sale_links"("sale_id");
CREATE INDEX "debt_sale_links_organization_id_idx"
  ON "debt_sale_links"("organization_id");
CREATE INDEX "debt_sale_links_organization_id_sale_id_idx"
  ON "debt_sale_links"("organization_id", "sale_id");

CREATE UNIQUE INDEX "debt_inventory_links_debt_id_inventory_position_id_key"
  ON "debt_inventory_links"("debt_id", "inventory_position_id");
CREATE INDEX "debt_inventory_links_organization_id_idx"
  ON "debt_inventory_links"("organization_id");
CREATE INDEX "debt_inventory_links_organization_id_inventory_position_id_idx"
  ON "debt_inventory_links"("organization_id", "inventory_position_id");

ALTER TABLE "debt_purchase_links"
  ADD CONSTRAINT "debt_purchase_links_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_purchase_links"
  ADD CONSTRAINT "debt_purchase_links_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_purchase_links"
  ADD CONSTRAINT "debt_purchase_links_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_sale_links"
  ADD CONSTRAINT "debt_sale_links_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_sale_links"
  ADD CONSTRAINT "debt_sale_links_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_sale_links"
  ADD CONSTRAINT "debt_sale_links_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_inventory_links"
  ADD CONSTRAINT "debt_inventory_links_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_inventory_links"
  ADD CONSTRAINT "debt_inventory_links_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "debt_inventory_links"
  ADD CONSTRAINT "debt_inventory_links_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'debt_purchase_links',
    'debt_sale_links',
    'debt_inventory_links'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = current_setting(''app.current_org_id'', true)) WITH CHECK (organization_id = current_setting(''app.current_org_id'', true))',
      table_name || '_tenant_policy',
      table_name
    );
  END LOOP;
END $$;
