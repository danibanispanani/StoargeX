import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInsightQueryScopes,
  calculateSaleScope,
} from "@/lib/dashboard/load-insight-dashboard";
import type { InsightFilters } from "@/lib/dashboard/insight-dashboard";

const filters: InsightFilters = {
  zeitraum: "30-tage",
  von: "",
  bis: "",
  platformId: "platform-a",
  marketplaceAccountId: "account-b",
  category: "Schuhe",
  ownership: "CONSIGNMENT",
  memberId: "member-c",
};

describe("dashboard insight query scopes", () => {
  it("attributes mixed sales only to matching category and ownership shares", () => {
    const scope = calculateSaleScope(
      [
        {
          label: "Owned shoe",
          grossAmountCents: 12_000,
          quantity: 2,
          category: "Schuhe",
          allocations: [
            { inventoryType: "OWNED", quantity: 1 },
            { inventoryType: "CONSIGNMENT", quantity: 1 },
          ],
        },
        {
          label: "Accessory",
          grossAmountCents: 8_000,
          quantity: 1,
          category: "Zubehör",
          allocations: [{ inventoryType: "OWNED", quantity: 1 }],
        },
      ],
      { category: "Schuhe", ownership: "OWNED" }
    );

    expect(scope).toEqual({
      financialRatio: 0.3,
      productLabels: ["Owned shoe"],
    });
  });

  it("combines platform, account, category and ownership for trade data", () => {
    const scopes = buildInsightQueryScopes(filters);

    expect(scopes.sale).toEqual({
      status: { not: "CANCELLED" },
      platformId: "platform-a",
      marketplaceAccountId: "account-b",
      saleLines: {
        some: {
          product: { category: "Schuhe" },
          allocations: { some: { inventoryTypeSnapshot: "CONSIGNMENT" } },
        },
      },
    });
    expect(scopes.inventory).toEqual({
      active: true,
      inventoryType: "CONSIGNMENT",
      product: { category: "Schuhe" },
      listings: { some: { platformId: "platform-a" } },
    });
    expect(scopes.expense).toEqual({ marketplaceAccountId: "account-b" });
  });

  it("applies member only to team data and never accepts an organization scope", () => {
    const scopes = buildInsightQueryScopes(filters);
    expect(scopes.task).toEqual({
      OR: [
        { assigneeId: "member-c" },
        { assignments: { some: { userId: "member-c" } } },
      ],
    });
    expect(JSON.stringify(scopes)).not.toContain("organizationId");
  });

  it("loads dashboard data only through the RLS-aware TenantDb seam", () => {
    const loader = readFileSync("lib/dashboard/load-insight-dashboard.ts", "utf8");
    const tenantDb = readFileSync("lib/tenant-db.ts", "utf8");

    expect(loader).toContain('import type { TenantDb } from "@/lib/tenant-db"');
    expect(loader).not.toContain('from "@/lib/prisma"');
    expect(tenantDb).toContain("app.current_org_id");
    expect(tenantDb).toContain("prisma.$transaction");
  });
});
