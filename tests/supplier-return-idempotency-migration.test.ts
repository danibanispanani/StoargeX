import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("supplier return planning idempotency migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20260801140000_supplier_return_idempotency/migration.sql",
    "utf8"
  );

  it("adds only a nullable key with a tenant-scoped unique index", () => {
    expect(sql).toContain('ADD COLUMN "idempotency_key" TEXT');
    expect(sql).toContain('("organization_id", "idempotency_key")');
    expect(sql).not.toContain("NOT NULL");
  });

  it("uses mapped PostgreSQL names for inventory row locks", () => {
    const service = readFileSync("lib/services/supplier-return-service.ts", "utf8");
    const metadata = readFileSync("lib/stock/stock-metadata-service.ts", "utf8");
    expect(service).toContain('FROM "inventory_positions"');
    expect(service).toContain('WHERE "organization_id"');
    expect(metadata).toContain('FROM "inventory_positions"');
    expect(metadata).toContain('FROM "stock_items"');
  });
});
