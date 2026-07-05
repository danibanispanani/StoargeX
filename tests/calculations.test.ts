import { describe, expect, it } from "vitest";
import {
  calcPurchaseNetCents,
  calcReturnLoss,
  euroToCents,
  feeNetCents,
  calcSale,
  calcShippingBaseCents,
  formatEuro,
  formatOrderId,
  grossToNetCents,
  parseSurcharges,
  rateCoversCountry,
  resolveTaxRatePercent,
  suggestShipping,
  type ShippingRateLike,
} from "@/lib/calculations";

describe("grossToNetCents", () => {
  it("rechnet 19% USt aus dem Brutto heraus", () => {
    expect(grossToNetCents(11900, 19)).toBe(10000);
  });

  it("rundet kaufmännisch", () => {
    // 100 / 1.19 = 84.0336... -> 84
    expect(grossToNetCents(100, 19)).toBe(84);
    // 995 / 1.07 = 929.906... -> 930
    expect(grossToNetCents(995, 7)).toBe(930);
  });

  it("liefert bei 0% den Bruttobetrag (z.B. §25a Differenzbesteuerung)", () => {
    expect(grossToNetCents(4999, 0)).toBe(4999);
  });

  it("wirft bei negativem Steuersatz", () => {
    expect(() => grossToNetCents(1000, -1)).toThrow();
  });
});

describe("calcPurchaseNetCents", () => {
  it("zieht bei Vorsteuerabzug die USt ab", () => {
    expect(calcPurchaseNetCents(11900, true, 19)).toBe(10000);
  });

  it("lässt den Brutto-EK unverändert, wenn kein Vorsteuerabzug möglich ist", () => {
    expect(calcPurchaseNetCents(11900, false, 19)).toBe(11900);
  });
});

describe("calcSale", () => {
  it("berechnet VK netto, Marge und Gewinn korrekt", () => {
    // VK 119,00 € brutto bei 19% -> 100,00 € netto
    // EK netto 40,00 €, Versand 5,00 €, Gebühren 11,00 € + 2,50 €
    const result = calcSale({
      saleGrossCents: 11900,
      taxRatePercent: 19,
      purchaseNetCents: 4000,
      shippingCostCents: 500,
      platformFeeCents: 1100,
      paymentFeeCents: 250,
    });
    expect(result.saleNetCents).toBe(10000);
    expect(result.marginCents).toBe(6000); // 100 - 40
    expect(result.profitCents).toBe(4150); // 60 - 5 - 11 - 2,50
  });

  it("kann negative Gewinne abbilden (Verlustverkauf)", () => {
    const result = calcSale({
      saleGrossCents: 1190,
      taxRatePercent: 19,
      purchaseNetCents: 2000,
      shippingCostCents: 500,
      platformFeeCents: 0,
      paymentFeeCents: 0,
    });
    expect(result.saleNetCents).toBe(1000);
    expect(result.marginCents).toBe(-1000);
    expect(result.profitCents).toBe(-1500);
  });

  it("0%-Satz: netto = brutto", () => {
    const result = calcSale({
      saleGrossCents: 5000,
      taxRatePercent: 0,
      purchaseNetCents: 3000,
      shippingCostCents: 0,
      platformFeeCents: 0,
      paymentFeeCents: 0,
    });
    expect(result.saleNetCents).toBe(5000);
    expect(result.profitCents).toBe(2000);
  });
});

describe("calcReturnLoss", () => {
  it("Vollerstattung: Erstattung netto minus voll gutgeschriebene Gebühren/Versand plus Zusatzkosten", () => {
    // Verkauf: 119,00 € brutto (19%), Gebühren 11,00 € + 2,50 €, Versand 5,49 €
    // Vollerstattung 119,00 € -> netto 100,00 €, Anteil 1.0
    // Verlust = 100,00 - (11,00 + 2,50 + 5,49) + 4,50 Rückversand = 85,51 €
    expect(
      calcReturnLoss({
        refundGrossCents: 11900,
        taxRatePercent: 19,
        saleGrossCents: 11900,
        platformFeeCents: 1100,
        paymentFeeCents: 250,
        shippingCostCents: 549,
        extraCostCents: 450,
      })
    ).toBe(8551);
  });

  it("Teilerstattung: Gebühren/Versand nur anteilig gegengerechnet", () => {
    // 50%-Erstattung von 100,00 € (0% USt): 50,00 € netto
    // anteilige Gebühren 0.5 x 10,00 € = 5,00 € -> Verlust 45,00 €
    expect(
      calcReturnLoss({
        refundGrossCents: 5000,
        taxRatePercent: 0,
        saleGrossCents: 10000,
        platformFeeCents: 1000,
        paymentFeeCents: 0,
        shippingCostCents: 0,
        extraCostCents: 0,
      })
    ).toBe(4500);
  });

  it("0%-USt (§25a): Erstattung bleibt brutto = netto", () => {
    expect(
      calcReturnLoss({
        refundGrossCents: 5000,
        taxRatePercent: 0,
        saleGrossCents: 5000,
        platformFeeCents: 0,
        paymentFeeCents: 0,
        shippingCostCents: 0,
        extraCostCents: 0,
      })
    ).toBe(5000);
  });

  it("Erstattung über VK wird beim Anteil auf 100% gekappt", () => {
    expect(
      calcReturnLoss({
        refundGrossCents: 12000,
        taxRatePercent: 0,
        saleGrossCents: 10000,
        platformFeeCents: 1000,
        paymentFeeCents: 0,
        shippingCostCents: 0,
        extraCostCents: 0,
      })
    ).toBe(11000); // 12000 - 1.0*1000
  });

  it("wirft bei negativer Erstattung", () => {
    expect(() =>
      calcReturnLoss({
        refundGrossCents: -1,
        taxRatePercent: 19,
        saleGrossCents: 100,
        platformFeeCents: 0,
        paymentFeeCents: 0,
        shippingCostCents: 0,
        extraCostCents: 0,
      })
    ).toThrow();
  });
});

describe("feeNetCents", () => {
  it("rechnet 19% USt heraus, wenn Gebühren inkl. MwSt sind", () => {
    expect(feeNetCents(1190, true)).toBe(1000);
  });

  it("lässt den Betrag unverändert ohne MwSt-Toggle", () => {
    expect(feeNetCents(1190, false)).toBe(1190);
  });
});

describe("resolveTaxRatePercent", () => {
  const rates = [
    { country: "DE", ratePercent: 19, isDefault: false },
    { country: "AT", ratePercent: 20, isDefault: false },
    { country: null, ratePercent: 19, isDefault: true },
  ];

  it("findet den exakten Ländersatz (case-insensitiv)", () => {
    expect(resolveTaxRatePercent(rates, "at")).toBe(20);
    expect(resolveTaxRatePercent(rates, "DE")).toBe(19);
  });

  it("fällt auf den Default-Satz zurück", () => {
    expect(resolveTaxRatePercent(rates, "FR")).toBe(19);
  });

  it("liefert 0, wenn weder Land noch Default existiert", () => {
    expect(resolveTaxRatePercent([], "DE")).toBe(0);
  });
});

describe("formatOrderId", () => {
  const date = new Date(2026, 6, 4); // 04.07.2026

  it("ersetzt Jahr und laufende Nummer mit führenden Nullen", () => {
    expect(formatOrderId("SX-{JJJJ}-{NR:4}", 7, date)).toBe("SX-2026-0007");
  });

  it("unterstützt {JJ}, {MM}, {TT} und {NR} ohne Breite", () => {
    expect(formatOrderId("{JJ}{MM}{TT}-{NR}", 123, date)).toBe("260704-123");
  });

  it("schneidet die Nummer nicht ab, wenn sie breiter als n ist", () => {
    expect(formatOrderId("V{NR:2}", 456, date)).toBe("V456");
  });

  it("lässt Formate ohne Tokens unverändert", () => {
    expect(formatOrderId("FIX", 1, date)).toBe("FIX");
  });
});

const dhlPaketM: ShippingRateLike = {
  carrierName: "DHL",
  name: "Paket M",
  zone: "DE",
  countries: ["DE"],
  baseCents: 549,
  perKgCents: 0,
  maxWeightKg: 10,
  surcharges: [],
};

const dpdEU: ShippingRateLike = {
  carrierName: "DPD",
  name: "Classic EU",
  zone: "EU",
  countries: ["AT", "FR", "NL"],
  baseCents: 999,
  perKgCents: 150,
  maxWeightKg: 31.5,
  surcharges: [{ label: "Sperrgut", cents: 500 }],
};

const upsWelt: ShippingRateLike = {
  carrierName: "UPS",
  name: "Express Welt",
  zone: "Welt",
  countries: [], // leer = alle Länder
  baseCents: 2999,
  perKgCents: 400,
  maxWeightKg: null,
  surcharges: [],
};

describe("rateCoversCountry", () => {
  it("matcht Länder der Zone case-insensitiv", () => {
    expect(rateCoversCountry(dpdEU, "at")).toBe(true);
    expect(rateCoversCountry(dpdEU, "US")).toBe(false);
  });

  it("leere Länderliste gilt weltweit", () => {
    expect(rateCoversCountry(upsWelt, "JP")).toBe(true);
  });
});

describe("calcShippingBaseCents", () => {
  it("Grundpreis + Gewicht x Kilopreis", () => {
    expect(calcShippingBaseCents(dpdEU, 2)).toBe(999 + 300);
  });

  it("rundet Kilopreis-Anteile", () => {
    // 1.5 kg x 150 Cent = 225 Cent
    expect(calcShippingBaseCents(dpdEU, 1.5)).toBe(999 + 225);
  });

  it("reiner Grundpreis bei Kilopreis 0", () => {
    expect(calcShippingBaseCents(dhlPaketM, 5)).toBe(549);
  });

  it("wirft bei negativem Gewicht", () => {
    expect(() => calcShippingBaseCents(dhlPaketM, -1)).toThrow();
  });
});

describe("suggestShipping", () => {
  const rates = [upsWelt, dpdEU, dhlPaketM];

  it("filtert nach Zielland und sortiert günstigster zuerst", () => {
    const result = suggestShipping(rates, "DE", 2);
    expect(result.map((s) => s.rate.carrierName)).toEqual(["DHL", "UPS"]);
    expect(result[0].costCents).toBe(549);
  });

  it("respektiert das Gewichtslimit des Tarifs", () => {
    const result = suggestShipping(rates, "DE", 12); // DHL max 10 kg
    expect(result.map((s) => s.rate.carrierName)).toEqual(["UPS"]);
  });

  it("überspringt inaktive Tarife", () => {
    const result = suggestShipping(
      [{ ...dhlPaketM, active: false }, upsWelt],
      "DE",
      1
    );
    expect(result.map((s) => s.rate.carrierName)).toEqual(["UPS"]);
  });

  it("liefert Zuschläge zur optionalen Auswahl mit", () => {
    const result = suggestShipping(rates, "AT", 1);
    expect(result[0].rate.carrierName).toBe("DPD");
    expect(result[0].surcharges).toEqual([{ label: "Sperrgut", cents: 500 }]);
  });
});

describe("parseSurcharges", () => {
  it("akzeptiert gültige Einträge und verwirft Müll", () => {
    expect(
      parseSurcharges([
        { label: "Sperrgut", cents: 500 },
        { label: 5, cents: "x" },
        "quatsch",
        null,
      ])
    ).toEqual([{ label: "Sperrgut", cents: 500 }]);
  });

  it("liefert [] für Nicht-Arrays", () => {
    expect(parseSurcharges(null)).toEqual([]);
    expect(parseSurcharges("[]")).toEqual([]);
  });
});

describe("euroToCents", () => {
  it("parst deutsche und englische Schreibweisen", () => {
    expect(euroToCents("12,50")).toBe(1250);
    expect(euroToCents("12.50")).toBe(1250);
    expect(euroToCents("1.299,99")).toBe(129999);
    expect(euroToCents("59")).toBe(5900);
    expect(euroToCents(" 5,00 € ")).toBe(500);
  });

  it("wirft bei ungültigen Eingaben", () => {
    expect(() => euroToCents("")).toThrow();
    expect(() => euroToCents("abc")).toThrow();
  });
});

describe("formatEuro", () => {
  it("formatiert Cent als Euro-Betrag", () => {
    // toLocaleString nutzt ein geschütztes Leerzeichen vor dem €-Zeichen
    const normalize = (s: string) => s.replace(/ /g, " ");
    expect(normalize(formatEuro(123456))).toBe("1.234,56 €");
    expect(normalize(formatEuro(-500))).toBe("-5,00 €");
  });
});
