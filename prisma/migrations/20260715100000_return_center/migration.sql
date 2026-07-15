-- Prompt 6 is strictly additive: preserve all legacy customer/supplier returns.
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'INSPECTION';
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'DEFECTIVE';
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "SupplierReturnStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "returns"
  ADD COLUMN "additional_costs_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "tracking_number" TEXT,
  ADD COLUMN "evidence_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "inspection_notes" TEXT,
  ADD COLUMN "inspected_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3);

ALTER TABLE "supplier_returns"
  ADD COLUMN "return_deadline" TIMESTAMP(3),
  ADD COLUMN "arrived_at" TIMESTAMP(3),
  ADD COLUMN "refund_expected_at" TIMESTAMP(3),
  ADD COLUMN "refunded_at" TIMESTAMP(3),
  ADD COLUMN "rma_number" TEXT,
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "shipping_cost_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expected_refund_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actual_refund_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "document_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "evidence_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rejection_reason" TEXT;

ALTER TABLE "supplier_return_lines"
  ADD COLUMN "source_bucket" "InventoryBucket" NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE "supplier_returns"
  ADD CONSTRAINT "supplier_returns_amounts_non_negative"
  CHECK (
    "shipping_cost_cents" >= 0 AND
    "expected_refund_cents" >= 0 AND
    "actual_refund_cents" >= 0
  );

CREATE INDEX "returns_organization_id_received_at_idx"
  ON "returns"("organization_id", "received_at");
CREATE INDEX "supplier_returns_organization_id_return_deadline_idx"
  ON "supplier_returns"("organization_id", "return_deadline");
CREATE INDEX "supplier_returns_organization_id_refund_expected_at_idx"
  ON "supplier_returns"("organization_id", "refund_expected_at");
