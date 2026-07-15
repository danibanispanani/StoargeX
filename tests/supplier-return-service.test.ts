import { describe, expect, it } from "vitest";
import {
  SupplierReturnDomainError,
  assertSupplierReturnTransition,
  classifySupplierRefund,
  getSupplierReturnDeadlineState,
  planSupplierReturnLinesFromSnapshots,
  type SupplierReturnInventorySnapshot,
} from "@/lib/services/supplier-return-service";

function snapshot(
  overrides: Partial<SupplierReturnInventorySnapshot> = {}
): SupplierReturnInventorySnapshot {
  return {
    organizationId: "org-a",
    purchaseId: "purchase-a",
    purchaseLineId: "purchase-line-a",
    inventoryPositionId: "position-a",
    inventoryType: "OWNED",
    quantities: {
      AVAILABLE: 4,
      RESERVED: 1,
      INSPECTION: 0,
      DEFECTIVE: 2,
    },
    unitPriceNetCents: 2_500,
    ...overrides,
  };
}

describe("supplier return line planning", () => {
  it("plans a partial quantity against its selected bucket", () => {
    const [line] = planSupplierReturnLinesFromSnapshots({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      selections: [
        {
          purchaseLineId: "purchase-line-a",
          inventoryPositionId: "position-a",
          sourceBucket: "AVAILABLE",
          quantity: 2,
          reason: "Falsche Variante",
        },
      ],
      snapshots: [snapshot()],
    });

    expect(line.quantity).toBe(2);
    expect(line.sourceBucket).toBe("AVAILABLE");
    expect(line.boundCapitalCents).toBe(5_000);
  });

  it("rejects quantities above the selected bucket", () => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "DEFECTIVE",
            quantity: 3,
          },
        ],
        snapshots: [snapshot()],
      })
    ).toThrow(/nur 2/);
  });

  it("rejects consignment positions and cross-tenant snapshots", () => {
    const selection = {
      purchaseLineId: "purchase-line-a",
      inventoryPositionId: "position-a",
      sourceBucket: "AVAILABLE" as const,
      quantity: 1,
    };

    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [selection],
        snapshots: [snapshot({ inventoryType: "CONSIGNMENT" })],
      })
    ).toThrow(/Eigenbestand/);

    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [selection],
        snapshots: [snapshot({ organizationId: "org-b" })],
      })
    ).toThrow(/Organisation/);
  });

  it("rejects the same position bucket twice", () => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "AVAILABLE",
            quantity: 1,
          },
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "AVAILABLE",
            quantity: 1,
          },
        ],
        snapshots: [snapshot()],
      })
    ).toThrow(/doppelt/);
  });
});

describe("supplier return workflow", () => {
  it("permits the operational path and rejection before dispatch", () => {
    expect(() => assertSupplierReturnTransition("DRAFT", "REQUESTED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("REQUESTED", "APPROVED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("APPROVED", "DISPATCHED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("DISPATCHED", "ARRIVED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("DISPATCHED", "PARTIALLY_REFUNDED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("REQUESTED", "REJECTED")).not.toThrow();
  });

  it("blocks completion before shipment and terminal-state changes", () => {
    expect(() => assertSupplierReturnTransition("DRAFT", "COMPLETED")).toThrow(
      SupplierReturnDomainError
    );
    expect(() => assertSupplierReturnTransition("COMPLETED", "DISPATCHED")).toThrow(
      /Statuswechsel/
    );
  });

  it("classifies open, partial, and full refunds without rounding ambiguity", () => {
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 0 })).toBe(
      "REFUND_PENDING"
    );
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 4_000 })).toBe(
      "PARTIALLY_REFUNDED"
    );
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 10_000 })).toBe(
      "REFUNDED"
    );
  });

  it("classifies deadlines by calendar day", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(getSupplierReturnDeadlineState(new Date("2026-07-14T23:00:00.000Z"), now)).toBe(
      "OVERDUE"
    );
    expect(getSupplierReturnDeadlineState(new Date("2026-07-17T23:00:00.000Z"), now)).toBe(
      "DUE_SOON"
    );
    expect(getSupplierReturnDeadlineState(new Date("2026-08-01T00:00:00.000Z"), now)).toBe(
      "ON_TRACK"
    );
  });
});
