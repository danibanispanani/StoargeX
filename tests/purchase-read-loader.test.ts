import { describe, expect, it } from "vitest";
import { calculateReceivedQuantityByLine } from "@/lib/purchases/purchase-read-loader";

describe("purchase read loader", () => {
  it("berechnet empfangene Mengen aus schmalen Summary-Zeilen ohne Doppelzaehlung", () => {
    const received = calculateReceivedQuantityByLine(
      ["line-1", "line-2", "line-3"],
      [
        {
          purchaseLineId: "line-1",
          quantity: 2,
          inventoryPositionId: "receipt-position",
          purchaseReceipt: { cancelledAt: null },
        },
        {
          purchaseLineId: "line-2",
          quantity: 3,
          inventoryPositionId: "cancelled-position",
          purchaseReceipt: { cancelledAt: new Date("2026-08-01T00:00:00.000Z") },
        },
      ],
      [
        {
          purchaseLineId: "line-1",
          inventoryPositionId: "receipt-position",
          inventoryPosition: { quantityReceived: 2 },
        },
        {
          purchaseLineId: "line-1",
          inventoryPositionId: "legacy-position",
          inventoryPosition: { quantityReceived: 5 },
        },
        {
          purchaseLineId: "line-2",
          inventoryPositionId: "cancelled-position",
          inventoryPosition: { quantityReceived: 3 },
        },
      ]
    );

    expect(received.get("line-1")).toBe(7);
    expect(received.get("line-2")).toBe(0);
    expect(received.get("line-3")).toBe(0);
  });
});
