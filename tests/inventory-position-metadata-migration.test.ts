import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("inventory position metadata migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20260801183000_inventory_position_metadata/migration.sql",
    "utf8"
  );

  it("adds only nullable non-booking metadata fields", () => {
    expect(sql).toContain('ADD COLUMN "location" TEXT');
    expect(sql).toContain('ADD COLUMN "notes" TEXT');
    expect(sql).not.toContain("NOT NULL");
    expect(sql).not.toContain("DROP COLUMN");
  });
});
