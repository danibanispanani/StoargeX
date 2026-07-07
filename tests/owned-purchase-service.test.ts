import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  deriveOwnedStockStatus,
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
