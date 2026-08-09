import { describe, expect, it } from "vitest";
import { mapProductsToOperationalRows } from "@/lib/products/product-read-loader";

describe("product read loader", () => {
  it("verwendet schmale Pricing-Summaries fuer die Produktzeilen", () => {
    const products = [
      {
        id: "product-1",
        name: "Sneaker",
        variant: "Black",
        brand: "Brand",
        category: "Shoes",
        ean: "123",
        size: "42",
        defaultPriceCents: 1000,
        defaultCondition: "NEW",
        defaultShippingCostCents: 500,
        defaultPackagingCostCents: 100,
        imageUrls: ["https://example.test/image.jpg"],
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-02T00:00:00.000Z"),
        marketplaceMappings: [
          {
            marketplaceCode: "EBAY_DE",
            feeCategoryId: "fee-ebay",
            feeCategory: { officialName: "eBay Shoes" },
          },
        ],
        pricingCalculations: [],
        _count: { purchaseLines: 2, inventoryPositions: 3, saleLines: 4 },
      },
    ] satisfies Parameters<typeof mapProductsToOperationalRows>[0];

    const rows = mapProductsToOperationalRows(products, [
      {
        productId: "product-1",
        marketplaceCode: "EBAY_DE",
        breakEvenCents: 1500,
        profitCents: 400,
        status: "READY",
        stale: false,
      },
      {
        productId: "product-1",
        marketplaceCode: "KAUFLAND_DE",
        breakEvenCents: 1600,
        profitCents: 300,
        status: "IDEA",
        stale: true,
      },
    ]);

    expect(rows[0]).toMatchObject({
      id: "product-1",
      name: "Sneaker",
      variant: "Black",
      ebayMapping: { feeCategoryId: "fee-ebay", label: "eBay Shoes" },
      ebayCalculation: {
        breakEvenCents: 1500,
        profitCents: 400,
        status: "READY",
        stale: false,
      },
      kauflandCalculation: {
        breakEvenCents: 1600,
        profitCents: 300,
        status: "IDEA",
        stale: true,
      },
      usage: { purchases: 2, inventory: 3, sales: 4 },
    });
  });
});
