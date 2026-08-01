-- Additive idempotency for planning supplier returns. Historical rows stay null.
ALTER TABLE "supplier_returns"
ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "supplier_returns_organization_id_idempotency_key_key"
ON "supplier_returns"("organization_id", "idempotency_key");

-- Supports the tenant-safe inventory-position metadata timeline.
CREATE INDEX "audit_logs_inventory_position_history_idx"
ON "audit_logs"(
  "organization_id",
  "entity_type",
  "entity_id",
  "action",
  "created_at",
  "id"
);
