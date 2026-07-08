-- Phase 8: import history, source references and historical relation quality.
CREATE TYPE "ImportBatchStatus" AS ENUM ('DRY_RUN', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM (
  'UNCHANGED',
  'UPDATE_AVAILABLE',
  'NEW',
  'LINKED',
  'PARTIALLY_LINKED',
  'UNRESOLVED',
  'REVIEW_REQUIRED',
  'CONFLICT',
  'ERROR'
);
CREATE TYPE "ImportTargetEntity" AS ENUM (
  'PRODUCT',
  'PURCHASE',
  'PURCHASE_LINE',
  'INVENTORY_POSITION',
  'CONSIGNMENT_LOT',
  'SALE',
  'SALE_LINE',
  'SALE_LINE_ALLOCATION',
  'RETURN',
  'RETURN_LINE',
  'DEBT',
  'TASK',
  'LEGACY_ONLY'
);
CREATE TYPE "HistoricalRelationStatus" AS ENUM (
  'LINKED',
  'PARTIALLY_LINKED',
  'UNRESOLVED',
  'REVIEW_REQUIRED'
);

ALTER TABLE "sales"
  ADD COLUMN "historical_relation_status" "HistoricalRelationStatus" NOT NULL DEFAULT 'LINKED';

CREATE TABLE "import_batches" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "import_type" TEXT NOT NULL,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_by_id" TEXT,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_references" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "import_batch_id" TEXT NOT NULL,
  "sheet_name" TEXT,
  "row_number" INTEGER NOT NULL,
  "row_hash" TEXT NOT NULL,
  "target_entity" "ImportTargetEntity" NOT NULL,
  "target_entity_id" TEXT NOT NULL,
  "legacy_reference" TEXT,
  "status" "ImportRowStatus" NOT NULL,
  "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_batches_organization_id_idx"
  ON "import_batches"("organization_id");
CREATE INDEX "import_batches_organization_id_import_type_idx"
  ON "import_batches"("organization_id", "import_type");
CREATE INDEX "import_batches_organization_id_file_hash_idx"
  ON "import_batches"("organization_id", "file_hash");

CREATE UNIQUE INDEX "source_references_organization_id_row_hash_target_entity_legacy_reference_key"
  ON "source_references"("organization_id", "row_hash", "target_entity", "legacy_reference");
CREATE INDEX "source_references_organization_id_idx"
  ON "source_references"("organization_id");
CREATE INDEX "source_references_organization_id_legacy_reference_idx"
  ON "source_references"("organization_id", "legacy_reference");
CREATE INDEX "source_references_organization_id_target_entity_target_entity_id_idx"
  ON "source_references"("organization_id", "target_entity", "target_entity_id");
CREATE INDEX "source_references_import_batch_id_idx"
  ON "source_references"("import_batch_id");

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "source_references"
  ADD CONSTRAINT "source_references_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "source_references"
  ADD CONSTRAINT "source_references_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['import_batches', 'source_references']
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
