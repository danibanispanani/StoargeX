import { describe, expect, it } from "vitest";
import { calcSale, grossToNetCents } from "@/lib/calculations";
import {
  planSaleAllocationsFromSnapshots,
  salePlanCostNetCents,
  type SaleInventorySnapshot,
} from "@/lib/services/sales-service";

function position(
  overrides: Partial<SaleInventorySnapshot> = {}
): SaleInventorySnapshot {
  return {
    id: "pos-1",
    organizationId: "org-a",
    productId: "product-a",
    productName: "Fire TV Stick",
    variant: "4K",
    size: null,
    inventoryType: "OWNED",
    inventoryNumber: "L-26-0001",
    quantityAvailable: 1,
    receivedAt: new Date(Date.UTC(2026, 0, 1)),
    unitCostNetCents: 3000,
    ...overrides,
  };
}

function plan(
  selections: Array<{ inventoryPositionId: string; quantity: number }>,
  candidates: SaleInventorySnapshot[],
  saleGrossCents = 10000
) {
  const saleNetCents = grossToNetCents(saleGrossCents, 19);
  return planSaleAllocationsFromSnapshots({
    organizationId: "org-a",
    selections,
    candidates,
    saleGrossCents,
    saleNetCents,
  });
}

describe("sales allocation planning", () => {
  it("verkauft einen Einzelartikel", () => {
    const lines = plan([{ inventoryPositionId: "pos-1", quantity: 1 }], [
      position(),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1);
    expect(lines[0].allocations).toEqual([
      expect.objectContaining({
        inventoryPositionId: "pos-1",
        quantity: 1,
        unitCostNetCents: 3000,
      }),
    ]);
  });

  it("verkauft Menge 3 aus einem Lot", () => {
    const lines = plan([{ inventoryPositionId: "pos-1", quantity: 3 }], [
      position({ quantityAvailable: 5 }),
    ]);

    expect(lines[0].quantity).toBe(3);
    expect(lines[0].allocations).toHaveLength(1);
    expect(lines[0].allocations[0].quantity).toBe(3);
  });

  it("verteilt Eigenbestand per FIFO über zwei Lots", () => {
    const lines = plan([{ inventoryPositionId: "pos-2", quantity: 3 }], [
      position({
        id: "pos-1",
        inventoryNumber: "L-26-0001",
        quantityAvailable: 2,
        receivedAt: new Date(Date.UTC(2026, 0, 1)),
        unitCostNetCents: 3000,
      }),
      position({
        id: "pos-2",
        inventoryNumber: "L-26-0002",
        quantityAvailable: 5,
        receivedAt: new Date(Date.UTC(2026, 0, 2)),
        unitCostNetCents: 3500,
      }),
    ]);

    expect(lines[0].allocations.map((allocation) => allocation.inventoryNumber)).toEqual([
      "L-26-0001",
      "L-26-0002",
    ]);
    expect(lines[0].allocations.map((allocation) => allocation.quantity)).toEqual([
      2,
      1,
    ]);
    expect(salePlanCostNetCents(lines)).toBe(9500);
  });

  it("mischt Eigenbestand und Konsignation im selben Verkauf", () => {
    const lines = plan(
      [
        { inventoryPositionId: "pos-owned", quantity: 2 },
        { inventoryPositionId: "pos-k", quantity: 3 },
      ],
      [
        position({
          id: "pos-owned",
          inventoryNumber: "L-26-0001",
          quantityAvailable: 2,
          unitCostNetCents: 3000,
        }),
        position({
          id: "pos-k",
          productId: "product-b",
          productName: "Konsi Artikel",
          inventoryType: "CONSIGNMENT",
          inventoryNumber: "K-26-0001",
          quantityAvailable: 3,
          unitCostNetCents: 1200,
          consignmentPartner: "Pattfield",
          consignmentSettlementCents: 1200,
        }),
      ],
      20000
    );

    expect(lines).toHaveLength(2);
    expect(lines.flatMap((line) => line.allocations).map((a) => a.inventoryType)).toEqual([
      "CONSIGNMENT",
      "OWNED",
    ]);
    expect(salePlanCostNetCents(lines)).toBe(9600);
  });

  it("blockiert Überverkauf", () => {
    expect(() =>
      plan([{ inventoryPositionId: "pos-1", quantity: 3 }], [
        position({ quantityAvailable: 2 }),
      ])
    ).toThrow(/nicht genug|nur 2/);
  });

  it("erzwingt Mandantentrennung", () => {
    expect(() =>
      plan([{ inventoryPositionId: "pos-1", quantity: 1 }], [
        position({ organizationId: "org-b" }),
      ])
    ).toThrow(/Mandanten/);
  });

  it("Gewinnberechnung nutzt Cost-Snapshots der Allocations", () => {
    const lines = plan([{ inventoryPositionId: "pos-1", quantity: 2 }], [
      position({ quantityAvailable: 2, unitCostNetCents: 2500 }),
    ]);
    const purchaseNetCents = salePlanCostNetCents(lines);
    const calc = calcSale({
      saleGrossCents: 11900,
      taxRatePercent: 19,
      purchaseNetCents,
      shippingCostCents: 500,
      platformFeeCents: 1000,
      paymentFeeCents: 0,
    });

    expect(purchaseNetCents).toBe(5000);
    expect(calc.marginCents).toBe(5000);
    expect(calc.profitCents).toBe(3500);
  });
});
