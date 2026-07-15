import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260715100000_return_center/migration.sql"
);

describe("return center additive migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("only extends return enums and tables", () => {
    expect(sql).toContain("ALTER TYPE \"SupplierReturnStatus\" ADD VALUE");
    expect(sql).toContain("ALTER TABLE \"supplier_returns\"");
    expect(sql).toContain("ALTER TABLE \"supplier_return_lines\"");
    expect(sql).toContain("ALTER TABLE \"returns\"");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  it("keeps supplier return amounts non-negative", () => {
    expect(sql).toContain("supplier_returns_amounts_non_negative");
  });
});
