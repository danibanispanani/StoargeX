-- Phase 4: add optional real RRP snapshot for new consignment lots.
ALTER TABLE "consignment_lots"
  ADD COLUMN "real_rrp_gross" DECIMAL(12, 2);
