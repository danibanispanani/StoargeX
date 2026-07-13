import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260713100000_beta_domain_entitlements/migration.sql"
  ),
  "utf8"
);

const TENANT_TABLES = [
  "business_partners",
  "business_partner_roles",
  "marketplace_accounts",
  "payout_accounts",
  "expense_categories",
  "expenses",
  "expense_recurrence_rules",
  "supplier_returns",
  "supplier_return_lines",
  "task_assignments",
  "task_checklist_items",
  "task_activities",
  "fee_schedules",
  "fee_rules",
  "feature_entitlements",
] as const;

describe("beta domain tenant isolation migration", () => {
  it.each(TENANT_TABLES)("%s besitzt eine verpflichtende organization_id", (table) => {
    const tableDefinition = migration.match(
      new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)CONSTRAINT "${table}_pkey"`)
    )?.[1];
    expect(tableDefinition).toContain('"organization_id" TEXT NOT NULL');
    expect(migration).toContain(`'${table}'`);
  });

  it("aktiviert und erzwingt RLS mit USING und WITH CHECK", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("app.current_org_id");
    expect(migration).toContain("WITH CHECK");
    expect(migration).toContain("app.bypass_rls");
  });
});
