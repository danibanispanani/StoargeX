import { describe, expect, it } from "vitest";
import {
  buildInsightSnapshot,
  parseInsightFilters,
  resolveInsightPeriod,
  type InsightSourceData,
} from "@/lib/dashboard/insight-dashboard";

const now = new Date("2026-07-17T12:00:00.000Z");

function source(overrides: Partial<InsightSourceData> = {}): InsightSourceData {
  return {
    now,
    lowStockThreshold: 2,
    sales: [],
    inventory: [],
    customerReturns: [],
    supplierReturns: [],
    expenses: [],
    debts: [],
    tasks: [],
    purchaseDeadlines: [],
    importConflicts: 0,
    ...overrides,
  };
}

describe("dashboard insight periods and filters", () => {
  it("resolves a rolling 30-day window and the immediately preceding period", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);

    expect(period.current.from.toISOString()).toBe("2026-06-18T00:00:00.000Z");
    expect(period.current.to.toISOString()).toBe("2026-07-17T23:59:59.999Z");
    expect(period.previous.from.toISOString()).toBe("2026-05-19T00:00:00.000Z");
    expect(period.previous.to.toISOString()).toBe("2026-06-17T23:59:59.999Z");
    expect(period.current.label).toBe("Letzte 30 Tage");
  });

  it("normalizes only supported filters and does not mix account and platform identities", () => {
    expect(
      parseInsightFilters({
        zeitraum: "7-tage",
        platform: " platform-a ",
        account: "account-b",
        category: " Schuhe ",
        ownership: "CONSIGNMENT",
        member: "member-c",
      })
    ).toEqual({
      zeitraum: "7-tage",
      von: "",
      bis: "",
      platformId: "platform-a",
      marketplaceAccountId: "account-b",
      category: "Schuhe",
      ownership: "CONSIGNMENT",
      memberId: "member-c",
    });

    expect(parseInsightFilters({ zeitraum: "invalid", ownership: "foreign" })).toEqual(
      expect.objectContaining({ zeitraum: "30-tage", ownership: "ALL" })
    );
    expect(parseInsightFilters({ von: "2026-02-31", bis: "not-a-date" })).toEqual(
      expect.objectContaining({ von: "", bis: "" })
    );
  });
});

describe("dashboard insight calculations", () => {
  it("calculates trade comparisons, transparent margin loads and both expense classes", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);
    const dashboard = buildInsightSnapshot(
      source({
        sales: [
          {
            id: "current-a",
            soldAt: new Date("2026-07-10T10:00:00.000Z"),
            revenueCents: 20_000,
            profitCents: 4_000,
            platformFeeCents: 2_000,
            shippingCostCents: 1_000,
            status: "COMPLETED",
            invoiceCreated: true,
            postageBooked: true,
            feesBooked: true,
            productLabels: ["Alpha"],
          },
          {
            id: "current-b",
            soldAt: new Date("2026-07-12T10:00:00.000Z"),
            revenueCents: 10_000,
            profitCents: -500,
            platformFeeCents: 1_000,
            shippingCostCents: 500,
            status: "PAID",
            invoiceCreated: false,
            postageBooked: false,
            feesBooked: false,
            productLabels: ["Beta"],
          },
          {
            id: "previous",
            soldAt: new Date("2026-06-01T10:00:00.000Z"),
            revenueCents: 20_000,
            profitCents: 2_000,
            platformFeeCents: 1_000,
            shippingCostCents: 500,
            status: "COMPLETED",
            invoiceCreated: true,
            postageBooked: true,
            feesBooked: true,
            productLabels: ["Alpha"],
          },
        ],
        expenses: [
          { id: "once", incurredAt: new Date("2026-07-03T00:00:00.000Z"), amountGrossCents: 1_000, recurring: false },
          { id: "monthly", incurredAt: new Date("2026-07-05T00:00:00.000Z"), amountGrossCents: 500, recurring: true },
        ],
      }),
      period
    );

    expect(dashboard.trade).toMatchObject({
      revenueCents: 30_000,
      profitCents: 3_500,
      salesCount: 2,
      marginPercent: 11.7,
      revenueChangePercent: 50,
      profitChangePercent: 75,
    });
    expect(dashboard.margin).toMatchObject({
      feeLoadPercent: 10,
      shippingLoadPercent: 5,
      belowTargetCount: 1,
    });
    expect(dashboard.cash).toMatchObject({
      oneTimeExpenseCents: 1_000,
      recurringExpenseCents: 500,
      profitBeforeExpensesCents: 3_500,
      profitAfterExpensesCents: 2_000,
      expectedPayoutCents: 9_000,
    });
  });

  it("keeps customer and supplier return pressure separate", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);
    const dashboard = buildInsightSnapshot(
      source({
        sales: [
          {
            id: "sale",
            soldAt: new Date("2026-07-01T00:00:00.000Z"),
            revenueCents: 10_000,
            profitCents: 2_000,
            platformFeeCents: 0,
            shippingCostCents: 0,
            status: "COMPLETED",
            invoiceCreated: true,
            postageBooked: true,
            feesBooked: true,
            productLabels: ["Alpha"],
          },
        ],
        customerReturns: [
          { id: "r1", requestedAt: new Date("2026-07-09T00:00:00.000Z"), lossCents: 1_200, open: true },
        ],
        supplierReturns: [
          {
            id: "sr1",
            returnDeadline: new Date("2026-07-19T00:00:00.000Z"),
            refundExpectedAt: new Date("2026-07-25T00:00:00.000Z"),
            expectedRefundCents: 5_000,
            actualRefundCents: 2_000,
            boundCapitalCents: 4_500,
            open: true,
            refundOpen: true,
          },
        ],
      }),
      period
    );

    expect(dashboard.returns.customer).toEqual({
      count: 1,
      ratePercent: 100,
      lossCents: 1_200,
      openCount: 1,
    });
    expect(dashboard.returns.supplier).toMatchObject({
      openCount: 1,
      deadlineCount: 1,
      openRefundCents: 3_000,
      boundCapitalCents: 4_500,
    });
    expect(dashboard.cash.cashRecoveryPercent).toBe(40);
  });

  it("does not invent a cash-recovery score without an expected refund basis", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);
    const dashboard = buildInsightSnapshot(source(), period);

    expect(dashboard.cash.cashRecoveryPercent).toBeNull();
  });

  it("derives inventory buckets, slow stock and team flow without a magic score", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);
    const dashboard = buildInsightSnapshot(
      source({
        inventory: [
          {
            id: "i1",
            productLabel: "Altbestand",
            inventoryType: "OWNED",
            receivedAt: new Date("2025-12-01T00:00:00.000Z"),
            available: 1,
            received: 5,
            reserved: 2,
            inspection: 1,
            defective: 1,
            unitCostCents: 3_000,
          },
          {
            id: "i2",
            productLabel: "Konsignation",
            inventoryType: "CONSIGNMENT",
            receivedAt: new Date("2026-07-01T00:00:00.000Z"),
            available: 4,
            received: 4,
            reserved: 0,
            inspection: 0,
            defective: 0,
            unitCostCents: 0,
          },
          {
            id: "i3",
            productLabel: "Konsignation niedrig",
            inventoryType: "CONSIGNMENT",
            receivedAt: new Date("2026-07-01T00:00:00.000Z"),
            available: 1,
            received: 5,
            reserved: 0,
            inspection: 0,
            defective: 0,
            unitCostCents: 0,
          },
        ],
        tasks: [
          { id: "t1", status: "OPEN", dueDate: new Date("2026-07-16T00:00:00.000Z"), assigneeLabels: ["Alex"], createdAt: new Date("2026-07-01T00:00:00.000Z"), completedAt: null, blocker: true },
          { id: "t2", status: "DONE", dueDate: null, assigneeLabels: ["Alex"], createdAt: new Date("2026-07-01T00:00:00.000Z"), completedAt: new Date("2026-07-11T00:00:00.000Z"), blocker: false },
        ],
      }),
      period
    );

    expect(dashboard.inventory).toMatchObject({
      available: 6,
      reserved: 2,
      inspection: 1,
      defective: 1,
      lowStockProducts: 1,
      slowStockUnits: 1,
      boundCapitalCents: 3_000,
    });
    expect(dashboard.team).toMatchObject({
      openCount: 1,
      overdueCount: 1,
      blockerCount: 1,
      averageCycleDays: 10,
    });
    expect(dashboard.inventory).not.toHaveProperty("score");
  });

  it("prioritizes actionable drill-downs and remains stable for empty and large inputs", () => {
    const period = resolveInsightPeriod({ zeitraum: "30-tage" }, now);
    const empty = buildInsightSnapshot(source(), period);
    expect(empty.attention).toEqual([]);
    expect(empty.trade.marginPercent).toBe(0);

    const manySales = Array.from({ length: 10_000 }, (_, index) => ({
      id: `sale-${index}`,
      soldAt: new Date("2026-07-01T00:00:00.000Z"),
      revenueCents: 100,
      profitCents: 20,
      platformFeeCents: 5,
      shippingCostCents: 5,
      status: "PAID",
      invoiceCreated: index % 2 === 0,
      postageBooked: true,
      feesBooked: true,
      productLabels: [`Product ${index % 10}`],
    }));
    const large = buildInsightSnapshot(
      source({
        sales: manySales,
        tasks: [{ id: "late", status: "OPEN", dueDate: new Date("2026-07-01T00:00:00.000Z"), assigneeLabels: [], createdAt: new Date("2026-06-01T00:00:00.000Z"), completedAt: null, blocker: false }],
        importConflicts: 3,
      }),
      period
    );

    expect(large.trade.salesCount).toBe(10_000);
    expect(large.trade.revenueCents).toBe(1_000_000);
    expect(large.attention[0]).toMatchObject({
      key: "overdue-tasks",
      href: "/aufgaben?view=faellig",
    });
    expect(large.attention.map((item) => item.href)).toContain("/importe?status=konflikt");
    expect(large.attention.map((item) => item.href)).toContain(
      "/verkauf?preset=finances&buchung=fehlt&von=2026-06-18&bis=2026-07-17"
    );
  });
});
