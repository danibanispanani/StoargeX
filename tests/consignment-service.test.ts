import { describe, expect, it } from "vitest";
import { DOCUMENT_PREFIXES, formatDocumentNumber } from "@/lib/services/document-number-service";
import {
  deriveConsignmentStockStatus,
  prepareConsignmentStock,
} from "@/lib/services/consignment-service";

describe("consignment stock planning", () => {
  it("unterstützt Pattfield-Position mit Menge 20", () => {
    const plan = prepareConsignmentStock({
      organizationId: "org-a",
      createdById: "user-a",
      partnerCompany: "Pattfield",
      productName: "Fire TV Stick",
      quantityReceived: 20,
      channelPrices: [{ label: "eBay R", cents: 4999 }],
    });

    expect(plan.partnerCompany).toBe("Pattfield");
    expect(plan.quantityReceived).toBe(20);
    expect(plan.quantityAvailable).toBe(20);
    expect(plan.channelPrices).toEqual([{ label: "eBay R", cents: 4999 }]);
  });

  it("erlaubt weitere Partnerfirma ohne Hardcoding", () => {
    const plan = prepareConsignmentStock({
      organizationId: "org-a",
      createdById: "user-a",
      partnerCompany: "Andere Partner GmbH",
      productName: "Echo Dot",
      quantityReceived: 5,
    });

    expect(plan.partnerCompany).toBe("Andere Partner GmbH");
    expect(plan.quantityAvailable).toBe(5);
  });

  it("validiert Bestandsverteilung aus verfügbar, verkauft, Prüfung und defekt", () => {
    const plan = prepareConsignmentStock({
      organizationId: "org-a",
      createdById: "user-a",
      partnerCompany: "Pattfield",
      productName: "Artikel",
      quantityReceived: 20,
      quantityAvailable: 16,
      quantitySold: 2,
      quantityInspection: 1,
      quantityDefective: 1,
    });

    expect(plan.quantityAvailable).toBe(16);
    expect(plan.quantitySold).toBe(2);
    expect(plan.quantityInspection).toBe(1);
    expect(plan.quantityDefective).toBe(1);
  });

  it("lehnt inkonsistente Bestandsverteilung ab", () => {
    expect(() =>
      prepareConsignmentStock({
        organizationId: "org-a",
        createdById: "user-a",
        partnerCompany: "Pattfield",
        productName: "Artikel",
        quantityReceived: 20,
        quantityAvailable: 20,
        quantitySold: 1,
      })
    ).toThrow(/entsprechen/);
  });

  it("nutzt K-Nummern für Konsignation", () => {
    expect(DOCUMENT_PREFIXES.CONSIGNMENT).toBe("K");
    expect(formatDocumentNumber(DOCUMENT_PREFIXES.CONSIGNMENT, 2026, 1)).toBe(
      "K-26-0001"
    );
  });

  it("leitet Status aus Konsignationsmengen ab", () => {
    expect(
      deriveConsignmentStockStatus({
        quantityAvailable: 20,
        quantityReceived: 20,
        quantityInspection: 0,
        quantityDefective: 0,
      })
    ).toBe("Verfügbar");
    expect(
      deriveConsignmentStockStatus({
        quantityAvailable: 0,
        quantityReceived: 20,
        quantityInspection: 0,
        quantityDefective: 1,
      })
    ).toBe("Defekt");
  });
});
