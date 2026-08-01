import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  classifyReturnDeadline,
  derivePurchaseProgress,
  deriveOwnedStockStatus,
  effectiveReceivedQuantity,
  planPurchaseReceipt,
  prepareOwnedPurchaseLines,
} from "@/lib/services/owned-purchase-service";

describe("owned purchase planning", () => {
  it("unterstützt Menge 1", () => {
    const [line] = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 1,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(line.quantity).toBe(1);
    expect(line.totalGrossCents).toBe(2999);
    expect(line.unitPriceNetCents).toBe(2520);
    expect(line.totalNetCents).toBe(2520);
  });

  it("plant einen Teilwareneingang ohne die Bestellmenge zu überschreiten", () => {
    const plan = planPurchaseReceipt({
      receivedAt: new Date("2026-07-14T10:00:00.000Z"),
      returnWindowDays: 30,
      lines: [
        {
          purchaseLineId: "line-1",
          orderedQuantity: 10,
          receivedQuantity: 3,
          quantity: 4,
        },
      ],
    });

    expect(plan.complete).toBe(false);
    expect(plan.lines[0]).toEqual(
      expect.objectContaining({ quantity: 4, remainingAfter: 3 })
    );
    expect(plan.returnDeadline?.toISOString()).toBe("2026-08-13T10:00:00.000Z");
  });

  it("erkennt einen vollständigen Wareneingang über mehrere Positionen", () => {
    const plan = planPurchaseReceipt({
      receivedAt: new Date("2026-07-14T10:00:00.000Z"),
      explicitReturnDeadline: new Date("2026-08-20T23:59:59.000Z"),
      lines: [
        { purchaseLineId: "line-1", orderedQuantity: 5, receivedQuantity: 2, quantity: 3 },
        { purchaseLineId: "line-2", orderedQuantity: 2, receivedQuantity: 0, quantity: 2 },
      ],
    });

    expect(plan.complete).toBe(true);
    expect(plan.totalQuantity).toBe(5);
    expect(plan.returnDeadline?.toISOString()).toBe("2026-08-20T23:59:59.000Z");
  });

  it("plant wiederholte Teilwareneingänge als getrennte Lot-Slices", () => {
    const first = planPurchaseReceipt({
      receivedAt: new Date("2026-07-14T10:00:00.000Z"),
      lines: [{ purchaseLineId: "line-1", orderedQuantity: 5, receivedQuantity: 0, quantity: 2 }],
    });
    const second = planPurchaseReceipt({
      receivedAt: new Date("2026-07-16T10:00:00.000Z"),
      lines: [{ purchaseLineId: "line-1", orderedQuantity: 5, receivedQuantity: 2, quantity: 3 }],
    });
    expect(first.lines[0].remainingAfter).toBe(3);
    expect(first.complete).toBe(false);
    expect(second.lines[0].remainingAfter).toBe(0);
    expect(second.complete).toBe(true);
    expect(first.receivedAt).not.toEqual(second.receivedAt);
  });

  it("behandelt Legacy-Lots ohne Receipt-Lines als bereits eingegangenen Bestand", () => {
    expect(effectiveReceivedQuantity({ receiptQuantities: [], legacyLotQuantities: [5] })).toBe(5);
    expect(effectiveReceivedQuantity({ receiptQuantities: [2, 3], legacyLotQuantities: [2, 3] })).toBe(5);
    expect(effectiveReceivedQuantity({ receiptQuantities: [0], legacyLotQuantities: [5] })).toBe(0);
    expect(effectiveReceivedQuantity({ receiptQuantities: [], legacyLotQuantities: [] })).toBe(0);
  });

  it("zählt gemischte Legacy-Lots und neue Receipt-Lines ohne Doppelzählung", () => {
    expect(effectiveReceivedQuantity({
      receiptQuantities: [2],
      legacyLotQuantities: [5, 2],
      receiptInventoryPositionIds: ["receipt-position"],
      legacyLots: [
        { inventoryPositionId: "legacy-position", quantity: 5 },
        { inventoryPositionId: "receipt-position", quantity: 2 },
      ],
    })).toBe(7);
    expect(effectiveReceivedQuantity({
      receiptQuantities: [0],
      legacyLotQuantities: [5, 0],
      receiptInventoryPositionIds: ["receipt-position"],
      legacyLots: [
        { inventoryPositionId: "legacy-position", quantity: 5 },
        { inventoryPositionId: "receipt-position", quantity: 0 },
      ],
    })).toBe(5);
  });

  it("leitet den Einkaufsstatus nach Wareneingang oder Storno aus aktiven Mengen ab", () => {
    expect(derivePurchaseProgress([
      { orderedQuantity: 5, receivedQuantity: 0 },
      { orderedQuantity: 2, receivedQuantity: 0 },
    ])).toEqual({ purchaseStatus: "ORDERED", shippingStatus: "NOT_SHIPPED" });

    expect(derivePurchaseProgress([
      { orderedQuantity: 5, receivedQuantity: 3 },
      { orderedQuantity: 2, receivedQuantity: 0 },
    ])).toEqual({ purchaseStatus: "PARTIALLY_RECEIVED", shippingStatus: "PARTIALLY_RECEIVED" });

    expect(derivePurchaseProgress([
      { orderedQuantity: 5, receivedQuantity: 5 },
      { orderedQuantity: 2, receivedQuantity: 2 },
    ])).toEqual({ purchaseStatus: "RECEIVED", shippingStatus: "DELIVERED" });
  });

  it("weist Überlieferung und mandantenfremde Bestellpositionen zurück", () => {
    expect(() =>
      planPurchaseReceipt({
        receivedAt: new Date("2026-07-14T10:00:00.000Z"),
        lines: [
          { purchaseLineId: "line-1", orderedQuantity: 5, receivedQuantity: 4, quantity: 2 },
        ],
      })
    ).toThrow("überschreitet die offene Menge");
  });

  it("klassifiziert Rückgabefristen als verständliche Aufmerksamkeitssignale", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(classifyReturnDeadline(null, now)).toBe("NONE");
    expect(classifyReturnDeadline(new Date("2026-07-13T12:00:00.000Z"), now)).toBe("OVERDUE");
    expect(classifyReturnDeadline(new Date("2026-07-17T12:00:00.000Z"), now)).toBe("DUE_SOON");
    expect(classifyReturnDeadline(new Date("2026-08-14T12:00:00.000Z"), now)).toBe("ACTIVE");
  });

  it("unterstützt Menge 10 als eine fachliche PurchaseLine", () => {
    const [line] = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 10,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: false,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(line.quantity).toBe(10);
    expect(line.unitPriceNetCents).toBe(2999);
    expect(line.totalGrossCents).toBe(29990);
    expect(line.totalNetCents).toBe(29990);
  });

  it("unterstützt mehrere PurchaseLines", () => {
    const lines = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 10,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
      {
        productName: "Echo Dot",
        quantity: 3,
        unitPriceGrossCents: 1999,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "E",
        returnEntryStatus: "NN",
      },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.quantity)).toEqual([10, 3]);
  });

  it("berechnet VST sauber aus Brutto zu Netto", () => {
    const [line] = prepareOwnedPurchaseLines([
      {
        productName: "Artikel",
        quantity: 2,
        unitPriceGrossCents: 11900,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(line.unitPriceNetCents).toBe(10000);
    expect(line.totalNetCents).toBe(20000);
    expect(centsToDecimalString(line.unitPriceNetCents)).toBe("100.00");
  });

  it("unterschiedliche Einkaufspreise bleiben getrennte Lines/Lots", () => {
    const lines = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 5,
        unitPriceGrossCents: 2499,
        inputTaxDeductible: false,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
      {
        productName: "Fire TV Stick",
        quantity: 5,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: false,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(lines.map((line) => line.unitPriceGrossCents)).toEqual([2499, 2999]);
  });

  it("gleicher Artikel bei anderem Händler wird auf Purchase-Ebene getrennt", () => {
    const amazonLine = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 2,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: false,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);
    const mediaLine = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 2,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: false,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(amazonLine[0].productName).toBe(mediaLine[0].productName);
    expect(amazonLine).not.toBe(mediaLine);
  });

  it("leitet Chargenstatus aus Mengen ab", () => {
    expect(
      deriveOwnedStockStatus({
        quantityAvailable: 10,
        quantityReceived: 10,
        quantityInspection: 0,
        quantityDefective: 0,
      })
    ).toBe("Verfügbar");
    expect(
      deriveOwnedStockStatus({
        quantityAvailable: 7,
        quantityReceived: 10,
        quantityInspection: 0,
        quantityDefective: 0,
      })
    ).toBe("Teilverkauft");
    expect(
      deriveOwnedStockStatus({
        quantityAvailable: 0,
        quantityReceived: 10,
        quantityInspection: 0,
        quantityDefective: 0,
      })
    ).toBe("Ausverkauft");
  });
});
