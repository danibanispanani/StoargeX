import { describe, expect, it } from "vitest";
import {
  assertCustomerReturnTransition,
  planReturnAllocationsFromSnapshots,
  type ReturnAllocationSnapshot,
} from "@/lib/services/returns-service";

function allocation(
  overrides: Partial<ReturnAllocationSnapshot> = {}
): ReturnAllocationSnapshot {
  return {
    id: "alloc-a",
    organizationId: "org-a",
    saleLineId: "line-a",
    inventoryPositionId: "pos-a",
    inventoryNumber: "L-26-0001",
    inventoryType: "OWNED",
    quantitySold: 3,
    quantityAlreadyReturned: 0,
    ...overrides,
  };
}

function plan(
  quantity: number,
  allocations: ReturnAllocationSnapshot[] = [allocation()]
) {
  return planReturnAllocationsFromSnapshots({
    organizationId: "org-a",
    selections: [{ saleLineAllocationId: allocations[0].id, quantity }],
    allocations,
  });
}

describe("return allocation planning", () => {
  it("Vollretoure erlaubt exakt verkaufte Menge", () => {
    const [result] = plan(3);

    expect(result.quantity).toBe(3);
    expect(result.returnableBefore).toBe(3);
    expect(result.inventoryPositionId).toBe("pos-a");
  });

  it("Teilretoure erlaubt kleinere Menge", () => {
    const [result] = plan(1);

    expect(result.quantity).toBe(1);
    expect(result.returnableBefore).toBe(3);
  });

  it("zweite Teilretoure berücksichtigt bereits retournierte Menge", () => {
    const [result] = plan(2, [
      allocation({ quantitySold: 3, quantityAlreadyReturned: 1 }),
    ]);

    expect(result.quantity).toBe(2);
    expect(result.returnableBefore).toBe(2);
  });

  it("zu hohe Retourenmenge wird blockiert", () => {
    expect(() =>
      plan(3, [allocation({ quantitySold: 3, quantityAlreadyReturned: 1 })])
    ).toThrow(/nur noch 2/);
  });

  it("angekündigte Retoure ist nur Planung und verändert Snapshots nicht", () => {
    const snapshot = allocation({ quantitySold: 3, quantityAlreadyReturned: 0 });
    plan(1, [snapshot]);

    expect(snapshot.quantitySold).toBe(3);
    expect(snapshot.quantityAlreadyReturned).toBe(0);
  });

  it("Konsignationsretoure bleibt der ursprünglichen K-Allocation zugeordnet", () => {
    const [result] = plan(1, [
      allocation({
        id: "alloc-k",
        inventoryNumber: "K-26-0001",
        inventoryType: "CONSIGNMENT",
        quantitySold: 1,
      }),
    ]);

    expect(result.inventoryType).toBe("CONSIGNMENT");
    expect(result.saleLineAllocationId).toBe("alloc-k");
  });

  it("Mandantentrennung blockiert fremde Allocation", () => {
    expect(() =>
      plan(1, [allocation({ organizationId: "org-b" })])
    ).toThrow(/Organisation/);
  });
});

describe("customer return workflow", () => {
  it("keeps inspection and disposition explicit", () => {
    expect(() => assertCustomerReturnTransition("REQUESTED", "INSPECTION")).not.toThrow();
    expect(() => assertCustomerReturnTransition("INSPECTION", "RESTOCKED")).not.toThrow();
    expect(() => assertCustomerReturnTransition("INSPECTION", "DEFECTIVE")).not.toThrow();
  });

  it("blocks a completed return from being booked again", () => {
    expect(() => assertCustomerReturnTransition("COMPLETED", "RESTOCKED")).toThrow(
      /Statuswechsel/
    );
  });
});
