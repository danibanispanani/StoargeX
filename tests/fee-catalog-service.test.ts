import { describe, expect, it } from "vitest";
import { getBundledFeeCatalog, loadBundledFeeCatalogs } from "@/lib/services/fee-catalog-service";
import { calculateMarketplacePrice } from "@/lib/services/marketplace-pricing-service";

describe("bundled fee catalogs", () => {
  it("bewahrt gleichnamige Hauptgruppe und konkrete Kategorie als getrennte Baumknoten", () => {
    const ebay = getBundledFeeCatalog("EBAY_DE");
    const category = ebay.categories.find((item) => item.externalCategoryId === "619");
    expect(category).toMatchObject({ group: "Musikinstrumente", officialName: "Musikinstrumente" });
    expect(category?.categoryKey).toContain(":619");
  });

  it("normalisiert zwei versionierte, gehashte offizielle Kataloge", () => {
    const catalogs = loadBundledFeeCatalogs();
    expect(catalogs.map((item) => item.definition.marketplaceCode)).toEqual(["EBAY_DE", "KAUFLAND_DE"]);
    expect(catalogs.every((item) => /^[a-f0-9]{64}$/.test(item.sourceHash))).toBe(true);
    expect(catalogs.every((item) => item.importReport.activationSafe)).toBe(true);
  });

  it("erhält offizielle eBay-Bezeichnung und Kategorie-ID", () => {
    const catalog = getBundledFeeCatalog("EBAY_DE");
    expect(catalog.categories).toContainEqual(expect.objectContaining({
      officialName: "Computer, Tablets & Netzwerk",
      externalCategoryId: "58058",
    }));
    expect(catalog.rules.some((rule) => rule.categoryId === "58058" && rule.condition === "USED" && rule.percentageBasisPoints === 500)).toBe(true);
  });

  it("enthält den vollständigen veröffentlichten Kaufland.de-Gebührenbereich inklusive Medien", () => {
    const catalog = getBundledFeeCatalog("KAUFLAND_DE");
    expect(catalog.categories).toHaveLength(13);
    expect(catalog.rules).toContainEqual(expect.objectContaining({ categoryId: "MEDIA", percentageBasisPoints: 1300, fixedItemFeeCents: 70 }));
    expect(catalog.definition.accountPlans).toEqual([
      { code: "BASIC", monthlyNetCents: 3995 },
      { code: "PLUS", monthlyNetCents: 5995 },
    ]);
  });

  it("rechnet den eBay-Platinrabatt auf variable und fixe Gebühren, nicht als Monatsumlage", () => {
    const catalog = getBundledFeeCatalog("EBAY_DE");
    const result = calculateMarketplacePrice({
      marketplaceCode: "EBAY_DE",
      marketplaceAccountId: "a",
      sellerProfile: "COMMERCIAL_ABOVE_STANDARD",
      shopModel: "PLATINUM",
      categoryId: "58058",
      condition: "NEW",
      calculatedAt: new Date("2026-07-14Z"),
      purchasePriceCents: 1000,
      purchasePriceMode: "NET",
      purchaseTaxRateBasisPoints: 1900,
      inputTaxDeductible: true,
      salePriceCents: 10000,
      buyerShippingCents: 0,
      ownShippingCents: 0,
      packagingCents: 0,
      otherDirectCostsCents: 0,
      quantity: 1,
      saleTaxRateBasisPoints: 1900,
      listingFeeMode: "NO",
      promotedListingBasisPoints: 0,
      internationalFeeBasisPoints: 0,
      rules: catalog.rules,
    });
    expect(result.fees.commissionNetCents).toBe(700);
    expect(result.fees.fixedOrderNetCents).toBe(45);
    expect(result.fees.shopDiscountNetCents).toBe(75);
    expect(result.fees.platformNetCents).toBe(670);
    expect(result.fees.monthlyAccountCostCents).toBe(0);
  });
});
