-- CreateEnum
CREATE TYPE "BusinessPartnerRoleType" AS ENUM ('SUPPLIER', 'CONSIGNMENT_PARTNER', 'CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceAccountType" AS ENUM ('BUSINESS', 'PRIVATE', 'MANAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('BANK', 'PAYPAL', 'PLATFORM_WALLET', 'SHAREHOLDER_PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'OPEN_BOX', 'REFURBISHED', 'USED', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseRecurrenceInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISPATCHED', 'CREDIT_PENDING', 'REPLACEMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskScope" AS ENUM ('PERSONAL', 'TEAM');

-- CreateEnum
CREATE TYPE "TaskAssignmentRole" AS ENUM ('PRIMARY', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "FeeRuleOrigin" AS ENUM ('MANUAL', 'IMPORTED', 'SYNCED');

-- CreateEnum
CREATE TYPE "FeeVatTreatment" AS ENUM ('INCLUDED', 'EXCLUDED', 'EXEMPT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('SUBSCRIPTION', 'ADD_ON', 'TRIAL', 'MANUAL');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'SUPPLIER_RETURN';

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'SUPPLIER_RETURN_OUT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportTargetEntity" ADD VALUE 'BUSINESS_PARTNER';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'MARKETPLACE_ACCOUNT';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'PAYOUT_ACCOUNT';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'EXPENSE_CATEGORY';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'EXPENSE';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'SUPPLIER_RETURN';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'SUPPLIER_RETURN_LINE';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'FEE_RULE';
ALTER TYPE "ImportTargetEntity" ADD VALUE 'FEATURE_ENTITLEMENT';

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "item_condition" "ItemCondition";

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "marketplace_account_id" TEXT,
ADD COLUMN     "payout_account_id" TEXT;

-- AlterTable
ALTER TABLE "return_lines" ADD COLUMN     "item_condition" "ItemCondition";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "progress_percent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scope" "TaskScope";

-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "marketplace_account_id" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "business_partner_id" TEXT,
ADD COLUMN     "payment_account_id" TEXT;

-- AlterTable
ALTER TABLE "inventory_positions" ADD COLUMN     "item_condition" "ItemCondition";

-- AlterTable
ALTER TABLE "consignment_lots" ADD COLUMN     "business_partner_id" TEXT;

-- CreateTable
CREATE TABLE "business_partners" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "external_ref" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_partner_roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_partner_id" TEXT NOT NULL,
    "role" "BusinessPartnerRoleType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_partner_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "external_account_id" TEXT,
    "account_type" "MarketplaceAccountType" NOT NULL DEFAULT 'BUSINESS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_payout_account_id" TEXT,
    "default_fee_schedule_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_partner_id" TEXT,
    "display_name" TEXT NOT NULL,
    "account_type" "PayoutAccountType" NOT NULL,
    "external_ref" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "category_id" TEXT,
    "supplier_id" TEXT,
    "payment_account_id" TEXT,
    "description" TEXT NOT NULL,
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "amount_gross" DECIMAL(12,2) NOT NULL,
    "amount_net" DECIMAL(12,2) NOT NULL,
    "tax_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receipt_reference" TEXT,
    "notes" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_recurrence_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "interval" "ExpenseRecurrenceInterval" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "rule" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "next_occurrence_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_returns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "return_number" TEXT,
    "purchase_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "supplier_snapshot" TEXT NOT NULL,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "tracking_number" TEXT,
    "credit_reference" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_return_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_return_id" TEXT NOT NULL,
    "purchase_line_id" TEXT NOT NULL,
    "inventory_position_id" TEXT NOT NULL,
    "outbound_movement_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "legacy_condition" TEXT,
    "item_condition" "ItemCondition",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TaskAssignmentRole" NOT NULL DEFAULT 'COLLABORATOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fee_schedule_id" TEXT,
    "platform_id" TEXT NOT NULL,
    "marketplace_account_id" TEXT,
    "category" TEXT,
    "item_condition" "ItemCondition",
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "percentage" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "fixed_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "minimum_fee_cents" INTEGER,
    "maximum_fee_cents" INTEGER,
    "advertising_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "payment_fee_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "vat_treatment" "FeeVatTreatment" NOT NULL DEFAULT 'UNKNOWN',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "origin" "FeeRuleOrigin" NOT NULL DEFAULT 'MANUAL',
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_entitlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "EntitlementSource" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "external_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_partners_organization_id_idx" ON "business_partners"("organization_id");

-- CreateIndex
CREATE INDEX "business_partners_organization_id_active_idx" ON "business_partners"("organization_id", "active");

-- CreateIndex
CREATE INDEX "business_partners_organization_id_external_ref_idx" ON "business_partners"("organization_id", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "business_partners_organization_id_display_name_key" ON "business_partners"("organization_id", "display_name");

-- CreateIndex
CREATE INDEX "business_partner_roles_organization_id_idx" ON "business_partner_roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_partner_roles_business_partner_id_role_key" ON "business_partner_roles"("business_partner_id", "role");

-- CreateIndex
CREATE INDEX "marketplace_accounts_organization_id_idx" ON "marketplace_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "marketplace_accounts_organization_id_active_idx" ON "marketplace_accounts"("organization_id", "active");

-- CreateIndex
CREATE INDEX "marketplace_accounts_platform_id_idx" ON "marketplace_accounts"("platform_id");

-- CreateIndex
CREATE INDEX "marketplace_accounts_default_payout_account_id_idx" ON "marketplace_accounts"("default_payout_account_id");

-- CreateIndex
CREATE INDEX "marketplace_accounts_default_fee_schedule_id_idx" ON "marketplace_accounts"("default_fee_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_accounts_organization_id_platform_id_display_na_key" ON "marketplace_accounts"("organization_id", "platform_id", "display_name");

-- CreateIndex
CREATE INDEX "payout_accounts_organization_id_idx" ON "payout_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "payout_accounts_organization_id_active_idx" ON "payout_accounts"("organization_id", "active");

-- CreateIndex
CREATE INDEX "payout_accounts_business_partner_id_idx" ON "payout_accounts"("business_partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_organization_id_display_name_key" ON "payout_accounts"("organization_id", "display_name");

-- CreateIndex
CREATE INDEX "expense_categories_organization_id_idx" ON "expense_categories"("organization_id");

-- CreateIndex
CREATE INDEX "expense_categories_organization_id_active_idx" ON "expense_categories"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_organization_id_name_key" ON "expense_categories"("organization_id", "name");

-- CreateIndex
CREATE INDEX "expenses_organization_id_idx" ON "expenses"("organization_id");

-- CreateIndex
CREATE INDEX "expenses_organization_id_incurred_at_idx" ON "expenses"("organization_id", "incurred_at");

-- CreateIndex
CREATE INDEX "expenses_organization_id_status_idx" ON "expenses"("organization_id", "status");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "expenses_supplier_id_idx" ON "expenses"("supplier_id");

-- CreateIndex
CREATE INDEX "expenses_payment_account_id_idx" ON "expenses"("payment_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_recurrence_rules_expense_id_key" ON "expense_recurrence_rules"("expense_id");

-- CreateIndex
CREATE INDEX "expense_recurrence_rules_organization_id_idx" ON "expense_recurrence_rules"("organization_id");

-- CreateIndex
CREATE INDEX "expense_recurrence_rules_organization_id_active_next_occurr_idx" ON "expense_recurrence_rules"("organization_id", "active", "next_occurrence_at");

-- CreateIndex
CREATE INDEX "supplier_returns_organization_id_idx" ON "supplier_returns"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_returns_organization_id_status_idx" ON "supplier_returns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "supplier_returns_organization_id_requested_at_idx" ON "supplier_returns"("organization_id", "requested_at");

-- CreateIndex
CREATE INDEX "supplier_returns_purchase_id_idx" ON "supplier_returns"("purchase_id");

-- CreateIndex
CREATE INDEX "supplier_returns_supplier_id_idx" ON "supplier_returns"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_returns_created_by_id_idx" ON "supplier_returns"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_returns_organization_id_return_number_key" ON "supplier_returns"("organization_id", "return_number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_return_lines_outbound_movement_id_key" ON "supplier_return_lines"("outbound_movement_id");

-- CreateIndex
CREATE INDEX "supplier_return_lines_organization_id_idx" ON "supplier_return_lines"("organization_id");

-- CreateIndex
CREATE INDEX "supplier_return_lines_supplier_return_id_idx" ON "supplier_return_lines"("supplier_return_id");

-- CreateIndex
CREATE INDEX "supplier_return_lines_purchase_line_id_idx" ON "supplier_return_lines"("purchase_line_id");

-- CreateIndex
CREATE INDEX "supplier_return_lines_inventory_position_id_idx" ON "supplier_return_lines"("inventory_position_id");

-- CreateIndex
CREATE INDEX "task_assignments_organization_id_idx" ON "task_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_task_id_user_id_key" ON "task_assignments"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_checklist_items_organization_id_idx" ON "task_checklist_items"("organization_id");

-- CreateIndex
CREATE INDEX "task_checklist_items_completed_by_id_idx" ON "task_checklist_items"("completed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_checklist_items_task_id_position_key" ON "task_checklist_items"("task_id", "position");

-- CreateIndex
CREATE INDEX "task_activities_organization_id_idx" ON "task_activities"("organization_id");

-- CreateIndex
CREATE INDEX "task_activities_task_id_created_at_idx" ON "task_activities"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_activities_actor_id_idx" ON "task_activities"("actor_id");

-- CreateIndex
CREATE INDEX "fee_schedules_organization_id_idx" ON "fee_schedules"("organization_id");

-- CreateIndex
CREATE INDEX "fee_schedules_organization_id_active_idx" ON "fee_schedules"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_organization_id_name_key" ON "fee_schedules"("organization_id", "name");

-- CreateIndex
CREATE INDEX "fee_rules_organization_id_idx" ON "fee_rules"("organization_id");

-- CreateIndex
CREATE INDEX "fee_rules_organization_id_active_valid_from_valid_until_idx" ON "fee_rules"("organization_id", "active", "valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "fee_rules_platform_id_idx" ON "fee_rules"("platform_id");

-- CreateIndex
CREATE INDEX "fee_rules_marketplace_account_id_idx" ON "fee_rules"("marketplace_account_id");

-- CreateIndex
CREATE INDEX "fee_rules_fee_schedule_id_idx" ON "fee_rules"("fee_schedule_id");

-- CreateIndex
CREATE INDEX "feature_entitlements_organization_id_idx" ON "feature_entitlements"("organization_id");

-- CreateIndex
CREATE INDEX "feature_entitlements_organization_id_feature_key_status_idx" ON "feature_entitlements"("organization_id", "feature_key", "status");

-- CreateIndex
CREATE INDEX "feature_entitlements_organization_id_starts_at_ends_at_idx" ON "feature_entitlements"("organization_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "sales_marketplace_account_id_idx" ON "sales"("marketplace_account_id");

-- CreateIndex
CREATE INDEX "sales_payout_account_id_idx" ON "sales"("payout_account_id");

-- CreateIndex
CREATE INDEX "credentials_marketplace_account_id_idx" ON "credentials"("marketplace_account_id");

-- CreateIndex
CREATE INDEX "purchases_business_partner_id_idx" ON "purchases"("business_partner_id");

-- CreateIndex
CREATE INDEX "purchases_payment_account_id_idx" ON "purchases"("payment_account_id");

-- CreateIndex
CREATE INDEX "consignment_lots_business_partner_id_idx" ON "consignment_lots"("business_partner_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_lots" ADD CONSTRAINT "consignment_lots_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partner_roles" ADD CONSTRAINT "business_partner_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partner_roles" ADD CONSTRAINT "business_partner_roles_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_accounts" ADD CONSTRAINT "marketplace_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_accounts" ADD CONSTRAINT "marketplace_accounts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_accounts" ADD CONSTRAINT "marketplace_accounts_default_payout_account_id_fkey" FOREIGN KEY ("default_payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_accounts" ADD CONSTRAINT "marketplace_accounts_default_fee_schedule_id_fkey" FOREIGN KEY ("default_fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_recurrence_rules" ADD CONSTRAINT "expense_recurrence_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_recurrence_rules" ADD CONSTRAINT "expense_recurrence_rules_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_supplier_return_id_fkey" FOREIGN KEY ("supplier_return_id") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_purchase_line_id_fkey" FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_inventory_position_id_fkey" FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_outbound_movement_id_fkey" FOREIGN KEY ("outbound_movement_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_entitlements" ADD CONSTRAINT "feature_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain checks that Prisma cannot express directly.
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amounts_non_negative" CHECK (
    "amount_gross" >= 0 AND
    "amount_net" >= 0 AND
    "tax_amount" >= 0 AND
    "tax_rate_percent" >= 0
  );

ALTER TABLE "expense_recurrence_rules"
  ADD CONSTRAINT "expense_recurrence_rules_interval_count_positive" CHECK ("interval_count" > 0),
  ADD CONSTRAINT "expense_recurrence_rules_date_order" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

ALTER TABLE "supplier_return_lines"
  ADD CONSTRAINT "supplier_return_lines_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_progress_percent_range" CHECK ("progress_percent" BETWEEN 0 AND 100);

ALTER TABLE "task_checklist_items"
  ADD CONSTRAINT "task_checklist_items_position_non_negative" CHECK ("position" >= 0),
  ADD CONSTRAINT "task_checklist_items_completion_consistent" CHECK (
    ("completed" = false AND "completed_at" IS NULL AND "completed_by_id" IS NULL)
    OR
    ("completed" = true)
  );

ALTER TABLE "fee_rules"
  ADD CONSTRAINT "fee_rules_date_order" CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from"),
  ADD CONSTRAINT "fee_rules_components_non_negative" CHECK (
    "percentage" >= 0 AND
    "fixed_fee_cents" >= 0 AND
    ("minimum_fee_cents" IS NULL OR "minimum_fee_cents" >= 0) AND
    ("maximum_fee_cents" IS NULL OR "maximum_fee_cents" >= 0) AND
    "advertising_percent" >= 0 AND
    "payment_fee_percent" >= 0
  ),
  ADD CONSTRAINT "fee_rules_minimum_maximum_order" CHECK (
    "minimum_fee_cents" IS NULL OR
    "maximum_fee_cents" IS NULL OR
    "maximum_fee_cents" >= "minimum_fee_cents"
  );

ALTER TABLE "feature_entitlements"
  ADD CONSTRAINT "feature_entitlements_date_order" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- PostgreSQL enforces the one-primary-assignee invariant while allowing any
-- number of collaborators. Scope-dependent cardinality stays in the service.
CREATE UNIQUE INDEX "task_assignments_one_primary_per_task_key"
  ON "task_assignments"("task_id")
  WHERE "role" = 'PRIMARY';

-- Every new tenant-owned table receives the same mandatory RLS boundary.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'business_partners',
    'business_partner_roles',
    'marketplace_accounts',
    'payout_accounts',
    'expense_categories',
    'expenses',
    'expense_recurrence_rules',
    'supplier_returns',
    'supplier_return_lines',
    'task_assignments',
    'task_checklist_items',
    'task_activities',
    'fee_schedules',
    'fee_rules',
    'feature_entitlements'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = current_setting(''app.current_org_id'', true)) WITH CHECK (organization_id = current_setting(''app.current_org_id'', true))',
      table_name || '_tenant_policy',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.bypass_rls'', true) = ''on'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''on'')',
      table_name || '_bypass_policy',
      table_name
    );
  END LOOP;
END $$;
