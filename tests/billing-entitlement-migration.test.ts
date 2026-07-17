import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260717210000_consignment_addon_billing/migration.sql"
);

describe("consignment add-on billing migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("extends entitlement lifecycle and Stripe references additively", () => {
    expect(sql).toContain(
      'ALTER TYPE "EntitlementStatus" ADD VALUE \'GRACE_PERIOD\''
    );
    expect(sql).toContain('ADD COLUMN "stripe_subscription_id" TEXT');
    expect(sql).toContain('ADD COLUMN "stripe_price_id" TEXT');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "feature_entitlements_stripe_subscription_id_key"'
    );
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  it("persists globally idempotent webhook processing without secret payloads", () => {
    expect(sql).toContain('CREATE TABLE "billing_webhook_events"');
    expect(sql).toContain('"stripe_event_id" TEXT NOT NULL');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "billing_webhook_events_stripe_event_id_key"'
    );
    expect(sql).not.toMatch(/raw_payload|signature|secret/i);
  });

  it("protects tenant-linked webhook traces with forced RLS", () => {
    expect(sql).toContain(
      'ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY'
    );
    expect(sql).toContain(
      'ALTER TABLE "billing_webhook_events" FORCE ROW LEVEL SECURITY'
    );
    expect(sql).toContain("app.current_org_id");
    expect(sql).toContain("app.bypass_rls");
    expect(sql).toContain("WITH CHECK");
  });
});
