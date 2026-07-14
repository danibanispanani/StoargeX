import { describe, expect, it } from "vitest";
import {
  MarketplacePricingError,
  calculateMarketplacePrice,
  findBreakEven,
  findMaximumPurchasePrice,
  findTargetMarginPrice,
  resolveMarketplaceFeeRule,
  type MarketplaceFeeRule,
  type MarketplacePricingInput,
} from "@/lib/services/marketplace-pricing-service";

const EBAY_STANDARD: MarketplaceFeeRule = {
  id: "ebay-tech-new",
  catalogId: "ebay-2026-07",
  catalogVersion: "2026-07",
  catalogStatus: "ACTIVE",
  marketplaceCode: "EBAY_DE",
  categoryId: "58058",
  officialCategoryName: "Computer, Tablets & Netzwerk",
  sellerProfile: "COMMERCIAL_ABOVE_STANDARD",
  shopModel: null,
  condition: "NEW",
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validUntil: null,
  priority: 10,
  percentageBasisPoints: 700,
  percentageAboveBasisPoints: null,
  tierThresholdCents: null,
  fixedOrderFeeCents: 35,
  fixedOrderThresholdCents: 1000,
  fixedOrderFeeAboveCents: 45,
  fixedItemFeeCents: 0,
  listingFeeCents: 35,
  minimumFeeCents: null,
  maximumFeeCents: null,
  feeVatRateBasisPoints: 1900,
  calculationBasis: "ITEM_PLUS_BUYER_SHIPPING",
};

const BASE_INPUT: MarketplacePricingInput = {
  marketplaceCode: "EBAY_DE",
  marketplaceAccountId: "account-ebay",
  sellerProfile: "COMMERCIAL_ABOVE_STANDARD",
  shopModel: "NONE",
  categoryId: "58058",
  condition: "NEW",
  calculatedAt: new Date("2026-07-14T10:00:00.000Z"),
  purchasePriceCents: 5000,
  purchasePriceMode: "NET",
  purchaseTaxRateBasisPoints: 1900,
  inputTaxDeductible: true,
  salePriceCents: 10000,
  buyerShippingCents: 500,
  ownShippingCents: 600,
  packagingCents: 100,
  otherDirectCostsCents: 0,
  quantity: 1,
  saleTaxRateBasisPoints: 1900,
  listingFeeMode: "NO",
  promotedListingBasisPoints: 0,
  internationalFeeBasisPoints: 0,
  rules: [EBAY_STANDARD],
};

describe("marketplace pricing", () => {
  it("berechnet eBay-Gebühr, Gebühren-USt, Auszahlung und Gewinn nachvollziehbar", () => {
    const result = calculateMarketplacePrice(BASE_INPUT);

    // Käufer zahlt 105,00; 7% Provision = 7,35; Fixanteil >10 EUR = 0,45.
    // eBay netto 7,80; USt 1,48; gewinnwirksam wegen Vorsteuerabzug 7,80.
    // Verkauf netto 88,24; Gewinn = 88,24 - 50 - 7,80 - 6 - 1 = 23,44.
    expect(result.fees.commissionNetCents).toBe(735);
    expect(result.fees.fixedOrderNetCents).toBe(45);
    expect(result.fees.vatCents).toBe(148);
    expect(result.fees.profitEffectiveCents).toBe(780);
    expect(result.expectedPayoutCents).toBe(9572);
    expect(result.profitCents).toBe(2344);
    expect(result.grossMarginCents).toBe(3824);
  });

  it("verwendet unter und über 10 EUR den offiziellen eBay-Fixanteil", () => {
    expect(calculateMarketplacePrice({ ...BASE_INPUT, salePriceCents: 900, buyerShippingCents: 0 }).fees.fixedOrderNetCents).toBe(35);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, salePriceCents: 1001, buyerShippingCents: 0 }).fees.fixedOrderNetCents).toBe(45);
  });

  it("löst Zustands- und Shopregeln spezifischer als die Standardregel auf", () => {
    const used: MarketplaceFeeRule = { ...EBAY_STANDARD, id: "used", condition: "USED", percentageBasisPoints: 500, priority: 20 };
    const platinum: MarketplaceFeeRule = { ...EBAY_STANDARD, id: "platinum", shopModel: "PLATINUM", percentageBasisPoints: 630, priority: 30 };
    expect(resolveMarketplaceFeeRule([...BASE_INPUT.rules, used, platinum], { ...BASE_INPUT, condition: "USED" }).id).toBe("used");
    expect(resolveMarketplaceFeeRule([...BASE_INPUT.rules, used, platinum], { ...BASE_INPUT, shopModel: "PLATINUM" }).id).toBe("platinum");
  });

  it("berechnet Preisstaffeln marginal und Basisanzeigen getrennt", () => {
    const tiered = {
      ...EBAY_STANDARD,
      percentageBasisPoints: 1200,
      percentageAboveBasisPoints: 300,
      tierThresholdCents: 99000,
    };
    const result = calculateMarketplacePrice({
      ...BASE_INPUT,
      salePriceCents: 100000,
      buyerShippingCents: 0,
      promotedListingBasisPoints: 250,
      rules: [tiered],
    });
    expect(result.fees.commissionNetCents).toBe(11910); // 12% von 990 + 3% von 10
    expect(result.fees.advertisingNetCents).toBe(2500);
  });

  it("begrenzt die prozentuale Provision mit optionalem Mindest- und Höchstwert", () => {
    const minimum = calculateMarketplacePrice({
      ...BASE_INPUT,
      salePriceCents: 1000,
      buyerShippingCents: 0,
      rules: [{ ...EBAY_STANDARD, minimumFeeCents: 100, maximumFeeCents: null }],
    });
    const maximum = calculateMarketplacePrice({
      ...BASE_INPUT,
      salePriceCents: 10000,
      buyerShippingCents: 0,
      rules: [{ ...EBAY_STANDARD, minimumFeeCents: null, maximumFeeCents: 500 }],
    });
    expect(minimum.fees.commissionNetCents).toBe(100);
    expect(maximum.fees.commissionNetCents).toBe(500);
  });

  it("wendet den Platin-Rabatt nur auf Verkaufsprovision und Fixanteil an", () => {
    const platinum: MarketplaceFeeRule = {
      ...EBAY_STANDARD,
      shopModel: "PLATINUM",
      shopDiscountBasisPoints: 1000,
      listingFeeCents: 50,
    };
    const result = calculateMarketplacePrice({
      ...BASE_INPUT,
      shopModel: "PLATINUM",
      listingFeeMode: "YES",
      promotedListingBasisPoints: 200,
      rules: [platinum],
    });
    expect(result.fees.commissionNetCents).toBe(735);
    expect(result.fees.fixedOrderNetCents).toBe(45);
    expect(result.fees.listingNetCents).toBe(50);
    expect(result.fees.advertisingNetCents).toBe(210);
    expect(result.fees.shopDiscountNetCents).toBe(78);
  });

  it("berücksichtigt Angebotsgebühr nur nach Modus und manuellen Gebührenoverride", () => {
    expect(calculateMarketplacePrice({ ...BASE_INPUT, listingFeeMode: "YES" }).fees.listingNetCents).toBe(35);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, listingFeeMode: "NO" }).fees.listingNetCents).toBe(0);
    const manual = calculateMarketplacePrice({ ...BASE_INPUT, manualPlatformFeeGrossCents: 1234 });
    expect(manual.fees.platformGrossCents).toBe(1234);
    expect(manual.warnings).toContain("MANUAL_FEE_OVERRIDE");
  });

  it("berechnet Kaufland.de einschließlich Käufer-Versand und Medien-Stückgebühr ohne Abo-Umlage", () => {
    const media: MarketplaceFeeRule = {
      ...EBAY_STANDARD,
      id: "kaufland-media",
      catalogId: "kaufland-2026-07",
      marketplaceCode: "KAUFLAND_DE",
      categoryId: "MEDIA",
      officialCategoryName: "Medien",
      sellerProfile: "COMMERCIAL",
      condition: null,
      percentageBasisPoints: 1300,
      fixedOrderFeeCents: 0,
      fixedOrderThresholdCents: null,
      fixedOrderFeeAboveCents: null,
      fixedItemFeeCents: 70,
      listingFeeCents: 0,
    };
    const result = calculateMarketplacePrice({
      ...BASE_INPUT,
      marketplaceCode: "KAUFLAND_DE",
      sellerProfile: "COMMERCIAL",
      shopModel: "PLUS",
      categoryId: "MEDIA",
      condition: null,
      salePriceCents: 2000,
      buyerShippingCents: 500,
      quantity: 2,
      internationalFeeBasisPoints: 250,
      rules: [media],
    });
    expect(result.fees.commissionNetCents).toBe(585);
    expect(result.fees.fixedItemNetCents).toBe(140);
    expect(result.fees.monthlyAccountCostCents).toBe(0);
    expect(result.fees.advertisingNetCents).toBe(0);
    expect(result.fees.internationalNetCents).toBe(0);
  });

  it("skaliert Artikelpreis und Einkauf mit der Menge, aber Versand nur einmal pro Auftrag", () => {
    const result = calculateMarketplacePrice({
      ...BASE_INPUT,
      salePriceCents: 1000,
      purchasePriceCents: 400,
      buyerShippingCents: 500,
      quantity: 2,
    });
    expect(result.customerGrossCents).toBe(2500);
    expect(result.purchaseProfitEffectiveCents).toBe(800);
    expect(result.fees.commissionNetCents).toBe(175);
  });

  it("findet den kleinsten centgenauen Preis ohne Verlust", () => {
    const result = findBreakEven({ ...BASE_INPUT, salePriceCents: 1 }, { maxSalePriceCents: 100_000 });
    expect(result.profitCents).toBeGreaterThanOrEqual(0);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, salePriceCents: result.salePriceCents - 1 }).profitCents).toBeLessThan(0);
  });

  it("ermittelt optional Zielmargenpreis und maximalen Einkaufspreis über dieselbe Berechnung", () => {
    const target = findTargetMarginPrice(BASE_INPUT, 1000, { maxSalePriceCents: 100_000 });
    expect(target.profitMarginBasisPoints).toBeGreaterThanOrEqual(1000);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, salePriceCents: target.salePriceCents - 1 }).profitMarginBasisPoints).toBeLessThan(1000);
    const maximumPurchase = findMaximumPurchasePrice(BASE_INPUT);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, purchasePriceCents: maximumPurchase }).profitCents).toBeGreaterThanOrEqual(0);
    expect(calculateMarketplacePrice({ ...BASE_INPUT, purchasePriceCents: maximumPurchase + 1 }).profitCents).toBeLessThan(0);
  });

  it("meldet fehlenden Katalog, Kategorie und ungestütztes Profil statt zu raten", () => {
    expect(() => calculateMarketplacePrice({ ...BASE_INPUT, rules: [] })).toThrowError(expect.objectContaining({ code: "MISSING_CATALOG" }));
    expect(() => calculateMarketplacePrice({ ...BASE_INPUT, categoryId: "unknown" })).toThrowError(expect.objectContaining({ code: "MISSING_CATEGORY" }));
    expect(() => calculateMarketplacePrice({ ...BASE_INPUT, sellerProfile: "BELOW_STANDARD" })).toThrowError(MarketplacePricingError);
  });
});
