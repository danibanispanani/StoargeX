import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260714110000_purchasing_inbound_workflow/migration.sql"), "utf8");

describe("purchasing inbound tenant isolation", () => {
  it.each(["purchase_receipts", "purchase_receipt_lines"])("%s ist verpflichtend tenant-gescoppt", (table) => {
    expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(migration).toContain('"organization_id" TEXT NOT NULL');
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(migration).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    expect(migration).toContain(`CREATE POLICY "${table}_tenant_policy"`);
    expect(migration).toContain(`CREATE POLICY "${table}_bypass_policy"`);
  });

  it("verankert Receipt-Lines an Bestellung, Position und unveränderlichem Movement", () => {
    expect(migration).toContain('FOREIGN KEY ("purchase_line_id") REFERENCES "purchase_lines"');
    expect(migration).toContain('FOREIGN KEY ("inventory_position_id") REFERENCES "inventory_positions"');
    expect(migration).toContain('FOREIGN KEY ("inbound_movement_id") REFERENCES "inventory_movements"');
    expect(migration).toContain('purchase_receipt_lines_quantity_positive');
  });
});
