-- Additive entitlement lifecycle for separately billed features.
ALTER TYPE "EntitlementStatus" ADD VALUE 'GRACE_PERIOD';

CREATE TYPE "BillingWebhookEventStatus" AS ENUM (
  'PROCESSING',
  'PROCESSED',
  'FAILED'
);

ALTER TABLE "feature_entitlements"
  ADD COLUMN "stripe_subscription_id" TEXT,
  ADD COLUMN "stripe_price_id" TEXT;

CREATE UNIQUE INDEX "feature_entitlements_stripe_subscription_id_key"
  ON "feature_entitlements"("stripe_subscription_id");

CREATE TABLE "billing_webhook_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "stripe_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" "BillingWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "error_message" TEXT,
  "payload_summary" JSONB NOT NULL DEFAULT '{}',
  "processed_at" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_webhook_events_stripe_event_id_key"
  ON "billing_webhook_events"("stripe_event_id");

CREATE INDEX "billing_webhook_events_organization_id_status_idx"
  ON "billing_webhook_events"("organization_id", "status");

CREATE INDEX "billing_webhook_events_status_last_attempt_at_idx"
  ON "billing_webhook_events"("status", "last_attempt_at");

ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_attempt_count_positive"
  CHECK ("attempt_count" > 0);

ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_webhook_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "billing_webhook_events_tenant_policy"
  ON "billing_webhook_events"
  USING (
    "organization_id" = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    "organization_id" = current_setting('app.current_org_id', true)
  );

CREATE POLICY "billing_webhook_events_bypass_policy"
  ON "billing_webhook_events"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
  );
