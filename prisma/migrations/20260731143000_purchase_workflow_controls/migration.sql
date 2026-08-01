ALTER TABLE "purchases"
ADD COLUMN "image_url" TEXT;

ALTER TABLE "purchase_receipts"
ADD COLUMN "cancelled_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "purchase_receipts_purchase_id_idx";

CREATE INDEX "purchase_receipts_purchase_id_cancelled_at_idx"
ON "purchase_receipts"("purchase_id", "cancelled_at");
