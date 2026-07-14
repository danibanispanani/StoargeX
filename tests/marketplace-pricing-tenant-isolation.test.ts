import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260714150000_marketplace_pricing_fees_expenses/migration.sql"), "utf8");

describe("marketplace pricing tenant isolation", () => {
  it.each(["fee_categories", "product_marketplace_mappings", "marketplace_pricing_calculations"])("%s erhält organization_id und erzwungenes RLS", (table) => {
    const tableDefinition = migration.match(new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)CONSTRAINT "${table}_pkey"`))?.[1];
    expect(tableDefinition).toContain('"organization_id" TEXT NOT NULL');
    expect(migration).toContain(`'${table}'`);
  });

  it("sichert aktive Kataloge und Ausgaben-Vorkommen mit mandantenbezogenen Unique-Keys", () => {
    expect(migration).toContain('"fee_schedules"("organization_id", "marketplace_code") WHERE "status" = \'ACTIVE\'');
    expect(migration).toContain('"expenses"("organization_id", "occurrence_key")');
    expect(migration).toContain("app.current_org_id");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
  });
});
