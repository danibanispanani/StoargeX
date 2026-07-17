import { describe, expect, it } from "vitest";
import {
  PRODUCT_TABLE_DEFINITION,
  buildProductOrderBy,
  buildProductSelectionWhere,
  buildProductWhere,
  parseProductTableQuery,
} from "@/lib/products/product-table";

describe("product table configuration", () => {
  it("keeps operational identity visible and secondary product fields optional", () => {
    const defaults = PRODUCT_TABLE_DEFINITION.columns
      .filter((column) => column.defaultVisible)
      .map((column) => column.key);
    const optional = PRODUCT_TABLE_DEFINITION.columns
      .filter((column) => !column.defaultVisible)
      .map((column) => column.key);

    expect(defaults).toEqual(["name", "variant", "category", "brand", "usage"]);
    expect(optional).toEqual([
      "ean",
      "defaultPrice",
      "size",
      "images",
      "updatedAt",
      "condition",
      "ebayCategory",
      "ebayBreakEven",
      "ebayProfit",
      "kauflandCategory",
      "kauflandBreakEven",
      "kauflandProfit",
      "calculationStatus",
    ]);
    expect(PRODUCT_TABLE_DEFINITION.presets.map((preset) => preset.key)).toEqual([
      "catalog",
      "used",
      "unused",
      "low-stock",
      "pricing",
    ]);
  });

  it("normalizes URL state and rejects unsupported sort and page sizes", () => {
    expect(
      parseProductTableQuery({
        q: "  Fire TV  ",
        sort: "foreign",
        direction: "desc",
        page: "-2",
        pageSize: "999",
        preset: "unused",
        category: "Elektronik",
        brand: "Amazon",
      })
    ).toMatchObject({
      q: "Fire TV",
      sort: "name",
      direction: "desc",
      page: 1,
      pageSize: 25,
      preset: "unused",
      category: "Elektronik",
      brand: "Amazon",
    });
  });

  it("builds combined case-insensitive search, filters and date range", () => {
    const query = parseProductTableQuery({
      q: "fire",
      category: "Elektronik",
      brand: "Amazon",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    const where = buildProductWhere(query, 2);

    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { category: { equals: "Elektronik", mode: "insensitive" } },
        { brand: { equals: "Amazon", mode: "insensitive" } },
        { updatedAt: { gte: new Date("2026-01-01T00:00:00.000Z") } },
        { updatedAt: { lte: new Date("2026-01-31T23:59:59.999Z") } },
      ]),
      OR: expect.arrayContaining([
        { name: { contains: "fire", mode: "insensitive" } },
        { brand: { contains: "fire", mode: "insensitive" } },
      ]),
    });
  });

  it("maps presets and bidirectional sorting to Prisma inputs", () => {
    expect(buildProductWhere(parseProductTableQuery({ preset: "unused" }), 1)).toMatchObject({
      AND: expect.arrayContaining([
        {
          purchaseLines: { none: {} },
          inventoryPositions: { none: {} },
          saleLines: { none: {} },
        },
      ]),
    });
    expect(buildProductWhere(parseProductTableQuery({ preset: "low-stock" }), 3)).toMatchObject({
      AND: expect.arrayContaining([
        {
          inventoryPositions: {
            some: {
              active: true,
              quantityReceived: { gt: 1 },
              quantityAvailable: { gt: 0, lte: 3 },
            },
          },
        },
      ]),
    });
    expect(buildProductOrderBy(parseProductTableQuery({ sort: "updatedAt", direction: "desc" }))).toEqual([
      { updatedAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("resolves explicit and all-result bulk selections without escaping the active filter", () => {
    const query = parseProductTableQuery({ category: "Elektronik" });
    expect(
      buildProductSelectionWhere(query, { mode: "explicit", ids: ["p1", "p2"] }, 1)
    ).toMatchObject({ AND: expect.arrayContaining([{ id: { in: ["p1", "p2"] } }]) });
    expect(
      buildProductSelectionWhere(query, { mode: "all", excludedIds: ["p9"] }, 1)
    ).toMatchObject({
      AND: expect.arrayContaining([
        { category: { equals: "Elektronik", mode: "insensitive" } },
        { id: { notIn: ["p9"] } },
      ]),
    });
  });
});
