import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stock cancellation and storage location migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20260801190000_stock_cancellation_locations/migration.sql",
    "utf8"
  );

  it("adds managed storage locations without rewriting historical values", () => {
    expect(sql).toContain("ALTER TYPE \"OptionKind\"");
    expect(sql).toContain("'STORAGE_LOCATION'");
  });

  it("tracks partial cancellation within the original receipt line", () => {
    expect(sql).toContain('ADD COLUMN "cancelled_quantity" INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('"cancelled_quantity" <= "quantity"');
  });
});
