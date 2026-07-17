-- Additive team-task foundation: snoozing and tenant-owned relational links.
CREATE TYPE "TaskDomainLinkType" AS ENUM (
  'PURCHASE',
  'INVENTORY_POSITION',
  'SALE',
  'CUSTOMER_RETURN',
  'SUPPLIER_RETURN',
  'DEBT'
);

ALTER TABLE "tasks"
  ADD COLUMN "snoozed_until" TIMESTAMP(3);

CREATE TABLE "task_domain_links" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "type" "TaskDomainLinkType" NOT NULL,
  "purchase_id" TEXT,
  "inventory_position_id" TEXT,
  "sale_id" TEXT,
  "customer_return_id" TEXT,
  "supplier_return_id" TEXT,
  "debt_id" TEXT,
  "label_snapshot" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_domain_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_domain_links_organization_id_idx" ON "task_domain_links"("organization_id");
CREATE INDEX "task_domain_links_task_id_idx" ON "task_domain_links"("task_id");
CREATE INDEX "task_domain_links_purchase_id_idx" ON "task_domain_links"("purchase_id");
CREATE INDEX "task_domain_links_inventory_position_id_idx" ON "task_domain_links"("inventory_position_id");
CREATE INDEX "task_domain_links_sale_id_idx" ON "task_domain_links"("sale_id");
CREATE INDEX "task_domain_links_customer_return_id_idx" ON "task_domain_links"("customer_return_id");
CREATE INDEX "task_domain_links_supplier_return_id_idx" ON "task_domain_links"("supplier_return_id");
CREATE INDEX "task_domain_links_debt_id_idx" ON "task_domain_links"("debt_id");
CREATE INDEX "tasks_organization_id_snoozed_until_idx" ON "tasks"("organization_id", "snoozed_until");

ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_inventory_position_id_fkey"
  FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_customer_return_id_fkey"
  FOREIGN KEY ("customer_return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_supplier_return_id_fkey"
  FOREIGN KEY ("supplier_return_id") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_domain_links" ADD CONSTRAINT "task_domain_links_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_domain_links"
  ADD CONSTRAINT "task_domain_links_exactly_one_target" CHECK (
    num_nonnulls(
      "purchase_id", "inventory_position_id", "sale_id",
      "customer_return_id", "supplier_return_id", "debt_id"
    ) = 1
  ),
  ADD CONSTRAINT "task_domain_links_type_matches_target" CHECK (
    ("type" = 'PURCHASE' AND "purchase_id" IS NOT NULL) OR
    ("type" = 'INVENTORY_POSITION' AND "inventory_position_id" IS NOT NULL) OR
    ("type" = 'SALE' AND "sale_id" IS NOT NULL) OR
    ("type" = 'CUSTOMER_RETURN' AND "customer_return_id" IS NOT NULL) OR
    ("type" = 'SUPPLIER_RETURN' AND "supplier_return_id" IS NOT NULL) OR
    ("type" = 'DEBT' AND "debt_id" IS NOT NULL)
  );

ALTER TABLE "task_domain_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_domain_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_domain_links_tenant_policy" ON "task_domain_links"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
CREATE POLICY "task_domain_links_bypass_policy" ON "task_domain_links"
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');
