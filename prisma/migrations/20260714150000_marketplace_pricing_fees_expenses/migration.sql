-- Additive marketplace pricing, catalog versioning and expense occurrence foundation.
CREATE TYPE "FeeCatalogStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "MarketplaceMappingStatus" AS ENUM ('UNASSIGNED', 'SUGGESTED', 'CONFIRMED', 'REVIEW_REQUIRED');
CREATE TYPE "PricingCalculationStatus" AS ENUM ('IDEA', 'REVIEW', 'INTERESTING', 'REJECTED', 'PURCHASED', 'CONVERTED_TO_PRODUCT');
CREATE TYPE "PricingInputMode" AS ENUM ('PRODUCT', 'FREE');
CREATE TYPE "MarketplacePriceSource" AS ENUM ('EBAY', 'IDEALO', 'KAUFLAND', 'EXPERIENCE', 'OTHER');
CREATE TYPE "TaxProfile" AS ENUM ('PRIVATE', 'SMALL_BUSINESS', 'VAT_REGISTERED');

ALTER TYPE "ImportTargetEntity" ADD VALUE 'FEE_SCHEDULE';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'FEE_CATEGORY';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'PRICING_CALCULATION';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'PRODUCT_MARKETPLACE_MAPPING';

ALTER TABLE "organizations"
  ADD COLUMN "tax_profile" "TaxProfile",
  ADD COLUMN "input_tax_deductible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "platforms"
  ADD COLUMN "marketplace_code" TEXT;

ALTER TABLE "products"
  ADD COLUMN "default_condition" "ItemCondition",
  ADD COLUMN "default_shipping_cost_cents" INTEGER,
  ADD COLUMN "default_packaging_cost_cents" INTEGER,
  ADD COLUMN "last_reference_sale_price_cents" INTEGER;

ALTER TABLE "sales"
  ADD COLUMN "pricing_calculation_id" TEXT,
  ADD COLUMN "fee_schedule_id" TEXT,
  ADD COLUMN "marketplace_fee_snapshot" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "marketplace_accounts"
  ADD COLUMN "marketplace_code" TEXT,
  ADD COLUMN "marketplace_country" TEXT,
  ADD COLUMN "seller_profile" TEXT,
  ADD COLUMN "shop_model" TEXT,
  ADD COLUMN "tax_profile" "TaxProfile",
  ADD COLUMN "standard_condition" "ItemCondition",
  ADD COLUMN "default_shipping_cost_cents" INTEGER,
  ADD COLUMN "default_packaging_cost_cents" INTEGER,
  ADD COLUMN "promoted_listings_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "default_advertising_percent" DECIMAL(7,4) NOT NULL DEFAULT 0;

ALTER TABLE "expenses"
  ADD COLUMN "marketplace_account_id" TEXT,
  ADD COLUMN "recurring_source_expense_id" TEXT,
  ADD COLUMN "occurrence_key" TEXT,
  ADD COLUMN "due_at" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3);

ALTER TABLE "fee_schedules"
  ADD COLUMN "platform_id" TEXT,
  ADD COLUMN "marketplace_code" TEXT,
  ADD COLUMN "seller_profile" TEXT,
  ADD COLUMN "catalog_version" TEXT,
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "retrieved_at" TIMESTAMP(3),
  ADD COLUMN "valid_from" TIMESTAMP(3),
  ADD COLUMN "valid_until" TIMESTAMP(3),
  ADD COLUMN "source_hash" TEXT,
  ADD COLUMN "status" "FeeCatalogStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "import_report" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "fee_rules"
  ADD COLUMN "fee_category_id" TEXT,
  ADD COLUMN "seller_profile" TEXT,
  ADD COLUMN "shop_model" TEXT,
  ADD COLUMN "percentage_above" DECIMAL(7,4),
  ADD COLUMN "tier_threshold_cents" INTEGER,
  ADD COLUMN "fixed_order_fee_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fixed_order_threshold_cents" INTEGER,
  ADD COLUMN "fixed_order_fee_above_cents" INTEGER,
  ADD COLUMN "fixed_item_fee_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "listing_fee_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shop_discount_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN "calculation_basis" TEXT NOT NULL DEFAULT 'ITEM_PLUS_BUYER_SHIPPING',
  ADD COLUMN "source_reference" TEXT;

CREATE TABLE "fee_categories" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "fee_schedule_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "marketplace_code" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "external_category_id" TEXT,
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "source_reference" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_marketplace_mappings" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "marketplace_account_id" TEXT,
  "fee_category_id" TEXT NOT NULL,
  "marketplace_code" TEXT NOT NULL,
  "status" "MarketplaceMappingStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_marketplace_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_pricing_calculations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT,
  "marketplace_account_id" TEXT,
  "fee_schedule_id" TEXT NOT NULL,
  "fee_category_id" TEXT NOT NULL,
  "marketplace_code" TEXT NOT NULL,
  "input_mode" "PricingInputMode" NOT NULL,
  "status" "PricingCalculationStatus" NOT NULL DEFAULT 'IDEA',
  "item_condition" "ItemCondition",
  "purchase_price_cents" INTEGER NOT NULL,
  "expected_sale_price_cents" INTEGER NOT NULL,
  "price_source" "MarketplacePriceSource",
  "input_snapshot" JSONB NOT NULL,
  "fee_breakdown" JSONB NOT NULL,
  "fee_rule_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "profit_cents" INTEGER NOT NULL,
  "margin_cents" INTEGER NOT NULL,
  "margin_basis_points" INTEGER,
  "break_even_cents" INTEGER NOT NULL,
  "expected_payout_cents" INTEGER NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "marketplace_pricing_calculations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_categories_schedule_marketplace_name_parent_key" ON "fee_categories"("fee_schedule_id", "marketplace_code", "official_name", "parent_id");
CREATE INDEX "fee_categories_organization_id_idx" ON "fee_categories"("organization_id");
CREATE INDEX "fee_categories_fee_schedule_id_idx" ON "fee_categories"("fee_schedule_id");
CREATE INDEX "fee_categories_parent_id_idx" ON "fee_categories"("parent_id");
CREATE INDEX "fee_categories_marketplace_external_idx" ON "fee_categories"("marketplace_code", "external_category_id");

CREATE UNIQUE INDEX "product_marketplace_mappings_product_marketplace_key" ON "product_marketplace_mappings"("product_id", "marketplace_code");
CREATE INDEX "product_marketplace_mappings_organization_id_idx" ON "product_marketplace_mappings"("organization_id");
CREATE INDEX "product_marketplace_mappings_fee_category_id_idx" ON "product_marketplace_mappings"("fee_category_id");
CREATE INDEX "product_marketplace_mappings_account_id_idx" ON "product_marketplace_mappings"("marketplace_account_id");

CREATE INDEX "marketplace_pricing_calculations_organization_id_idx" ON "marketplace_pricing_calculations"("organization_id");
CREATE INDEX "marketplace_pricing_calculations_marketplace_date_idx" ON "marketplace_pricing_calculations"("organization_id", "marketplace_code", "calculated_at");
CREATE INDEX "marketplace_pricing_calculations_product_id_idx" ON "marketplace_pricing_calculations"("product_id");
CREATE INDEX "marketplace_pricing_calculations_account_id_idx" ON "marketplace_pricing_calculations"("marketplace_account_id");
CREATE INDEX "marketplace_pricing_calculations_schedule_id_idx" ON "marketplace_pricing_calculations"("fee_schedule_id");
CREATE INDEX "marketplace_pricing_calculations_category_id_idx" ON "marketplace_pricing_calculations"("fee_category_id");

CREATE INDEX "fee_schedules_platform_id_idx" ON "fee_schedules"("platform_id");
CREATE INDEX "fee_schedules_marketplace_status_idx" ON "fee_schedules"("organization_id", "marketplace_code", "status");
CREATE UNIQUE INDEX "fee_schedules_one_active_catalog_key" ON "fee_schedules"("organization_id", "marketplace_code") WHERE "status" = 'ACTIVE' AND "marketplace_code" IS NOT NULL;
CREATE INDEX "fee_rules_fee_category_id_idx" ON "fee_rules"("fee_category_id");
CREATE INDEX "sales_pricing_calculation_id_idx" ON "sales"("pricing_calculation_id");
CREATE INDEX "sales_fee_schedule_id_idx" ON "sales"("fee_schedule_id");
CREATE INDEX "expenses_marketplace_account_id_idx" ON "expenses"("marketplace_account_id");
CREATE INDEX "expenses_recurring_source_expense_id_idx" ON "expenses"("recurring_source_expense_id");
CREATE UNIQUE INDEX "expenses_organization_occurrence_key" ON "expenses"("organization_id", "occurrence_key");

ALTER TABLE "products" ADD CONSTRAINT "products_marketplace_costs_non_negative" CHECK (
  ("default_shipping_cost_cents" IS NULL OR "default_shipping_cost_cents" >= 0) AND
  ("default_packaging_cost_cents" IS NULL OR "default_packaging_cost_cents" >= 0) AND
  ("last_reference_sale_price_cents" IS NULL OR "last_reference_sale_price_cents" >= 0)
);
ALTER TABLE "marketplace_accounts" ADD CONSTRAINT "marketplace_accounts_defaults_non_negative" CHECK (
  ("default_shipping_cost_cents" IS NULL OR "default_shipping_cost_cents" >= 0) AND
  ("default_packaging_cost_cents" IS NULL OR "default_packaging_cost_cents" >= 0) AND
  "default_advertising_percent" >= 0
);
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_date_order" CHECK ("valid_until" IS NULL OR "valid_from" IS NULL OR "valid_until" > "valid_from");
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_marketplace_components_non_negative" CHECK (
  ("percentage_above" IS NULL OR "percentage_above" >= 0) AND
  ("tier_threshold_cents" IS NULL OR "tier_threshold_cents" >= 0) AND
  "fixed_order_fee_cents" >= 0 AND
  ("fixed_order_threshold_cents" IS NULL OR "fixed_order_threshold_cents" >= 0) AND
  ("fixed_order_fee_above_cents" IS NULL OR "fixed_order_fee_above_cents" >= 0) AND
  "fixed_item_fee_cents" >= 0 AND
  "listing_fee_cents" >= 0 AND
  "shop_discount_percent" >= 0 AND "shop_discount_percent" <= 100
);
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_money_non_negative" CHECK (
  "purchase_price_cents" >= 0 AND "expected_sale_price_cents" >= 0 AND "break_even_cents" >= 0
);

ALTER TABLE "sales" ADD CONSTRAINT "sales_pricing_calculation_id_fkey" FOREIGN KEY ("pricing_calculation_id") REFERENCES "marketplace_pricing_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_source_expense_id_fkey" FOREIGN KEY ("recurring_source_expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_fee_category_id_fkey" FOREIGN KEY ("fee_category_id") REFERENCES "fee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "fee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_marketplace_mappings" ADD CONSTRAINT "product_marketplace_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_marketplace_mappings" ADD CONSTRAINT "product_marketplace_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_marketplace_mappings" ADD CONSTRAINT "product_marketplace_mappings_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_marketplace_mappings" ADD CONSTRAINT "product_marketplace_mappings_fee_category_id_fkey" FOREIGN KEY ("fee_category_id") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_pricing_calculations" ADD CONSTRAINT "marketplace_pricing_calculations_category_id_fkey" FOREIGN KEY ("fee_category_id") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['fee_categories', 'product_marketplace_mappings', 'marketplace_pricing_calculations']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = current_setting(''app.current_org_id'', true)) WITH CHECK (organization_id = current_setting(''app.current_org_id'', true))', table_name || '_tenant_policy', table_name);
    EXECUTE format('CREATE POLICY %I ON %I USING (current_setting(''app.bypass_rls'', true) = ''on'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''on'')', table_name || '_bypass_policy', table_name);
  END LOOP;
END $$;
