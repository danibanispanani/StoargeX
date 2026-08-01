-- Add organization-managed storage locations and traceable partial receipt cancellation.
ALTER TYPE "OptionKind" ADD VALUE IF NOT EXISTS 'STORAGE_LOCATION';

ALTER TABLE "purchase_receipt_lines"
ADD COLUMN "cancelled_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "purchase_receipt_lines"
ADD CONSTRAINT "purchase_receipt_lines_cancelled_quantity_check"
CHECK ("cancelled_quantity" >= 0 AND "cancelled_quantity" <= "quantity");
