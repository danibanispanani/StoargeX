-- Phase 1 recovery: add the missing Purchase.createdBy relation.
-- Additive follow-up migration because the previous phase-1 migration may already
-- have been applied on external databases.

CREATE INDEX "purchases_created_by_id_idx" ON "purchases"("created_by_id");

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
