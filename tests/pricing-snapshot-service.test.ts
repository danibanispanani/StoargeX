import { describe, expect, it } from "vitest";
import {
  buildProductPricingDefaults,
  createPricingSnapshotFingerprint,
  isPricingSnapshotStale,
} from "@/lib/services/pricing-snapshot-service";

describe("pricing product integration", () => {
  const product = {
    id: "product-1",
    name: "Example Phone",
    brand: "Example",
    variant: "128 GB",
    size: null,
    ean: "1234567890123",
    defaultPriceCents: 5000,
    defaultCondition: "NEW" as const,
    defaultShippingCostCents: 600,
    defaultPackagingCostCents: 100,
    lastReferenceSalePriceCents: 10000,
    mappings: [
      { marketplaceCode: "EBAY_DE", categoryId: "58058", status: "CONFIRMED" as const },
      { marketplaceCode: "KAUFLAND_DE", categoryId: "ELECTRONICS", status: "CONFIRMED" as const },
    ],
  };

  it("übernimmt Produktwerte in eine überschreibbare Kopie ohne Produktmutation", () => {
    const defaults = buildProductPricingDefaults(product, "EBAY_DE");
    defaults.purchasePriceCents = 1;
    expect(defaults.categoryId).toBe("58058");
    expect(product.defaultPriceCents).toBe(5000);
  });

  it("hält eBay- und Kaufland-Kategorien getrennt", () => {
    expect(buildProductPricingDefaults(product, "EBAY_DE").categoryId).toBe("58058");
    expect(buildProductPricingDefaults(product, "KAUFLAND_DE").categoryId).toBe("ELECTRONICS");
  });

  it("markiert Snapshots bei relevanten Änderungen, aber nicht bei Anzeigenamen als veraltet", () => {
    const base = {
      productId: product.id,
      purchasePriceCents: 5000,
      categoryId: "58058",
      condition: "NEW",
      shippingCents: 600,
      packagingCents: 100,
      marketplaceAccountId: "account-1",
      feeCatalogId: "catalog-1",
      feeRuleIds: ["rule-1"],
    };
    const fingerprint = createPricingSnapshotFingerprint(base);
    expect(isPricingSnapshotStale(fingerprint, { ...base, displayName: "Umbenannt" })).toBe(false);
    expect(isPricingSnapshotStale(fingerprint, { ...base, feeCatalogId: "catalog-2" })).toBe(true);
  });
});
