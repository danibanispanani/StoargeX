import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { ProductOperationalRow } from "@/components/products/product-table";
import {
  buildProductOrderBy,
  buildProductWhere,
  parseProductTableQuery,
  productQueryToSearchParams,
  type ProductTableQuery,
} from "@/lib/products/product-table";
import type { TenantDb } from "@/lib/tenant-db";

interface ProductReadTrace {
  measureDb<T>(name: string, task: () => Promise<T>, queryCount?: number): Promise<T>;
}

type ProductSearchParams = Record<string, string | string[] | undefined>;

export interface ProductInitialReadResult {
  rows: ProductOperationalRow[];
  totalResults: number;
  query: ProductTableQuery;
  queryString: string;
  allResultDigest: string | null;
  categories: string[];
  brands: string[];
  ebayCategories: Array<{ id: string; label: string; externalId: string }>;
  kauflandCategories: Array<{ id: string; label: string; externalId: string }>;
  rowCounts: {
    products: number;
    totalResults: number;
    categories: number;
    brands: number;
    feeCategories: number;
    selectionRows: number;
    pricingSummaries: number;
    digestComputed: number;
  };
}

const productListSelect = {
  id: true,
  name: true,
  variant: true,
  brand: true,
  category: true,
  ean: true,
  size: true,
  defaultPriceCents: true,
  defaultCondition: true,
  defaultShippingCostCents: true,
  defaultPackagingCostCents: true,
  imageUrls: true,
  createdAt: true,
  updatedAt: true,
  marketplaceMappings: {
    select: {
      marketplaceCode: true,
      feeCategoryId: true,
      feeCategory: { select: { officialName: true } },
    },
  },
  pricingCalculations: {
    where: { marketplaceCode: { in: ["EBAY_DE", "KAUFLAND_DE"] } },
    orderBy: { calculatedAt: "desc" },
    take: 10,
    select: {
      marketplaceCode: true,
      breakEvenCents: true,
      profitCents: true,
      status: true,
      stale: true,
    },
  },
  _count: {
    select: {
      purchaseLines: true,
      inventoryPositions: true,
      saleLines: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ProductListRecord = Prisma.ProductGetPayload<{ select: typeof productListSelect }>;

export type ProductPricingSummary = {
  productId: string;
  marketplaceCode: string;
  breakEvenCents: number;
  profitCents: number;
  status: string;
  stale: boolean;
};

export async function loadProductInitialRead(input: {
  db: TenantDb;
  organizationId: string;
  params: ProductSearchParams;
  lowStockThreshold?: number;
  trace?: ProductReadTrace;
}): Promise<ProductInitialReadResult> {
  const { db, organizationId, params, trace } = input;
  const measureDb = <T>(name: string, task: () => Promise<T>, queryCount = 1) =>
    trace ? trace.measureDb(name, task, queryCount) : task();
  const requestedQuery = parseProductTableQuery(params);
  const lowStockThreshold =
    typeof input.lowStockThreshold === "number"
      ? input.lowStockThreshold
      : requestedQuery.preset !== "low-stock"
        ? 0
        : await measureDb("product.organization_threshold", async () => {
          const organization = await db.organization.findUnique({
            where: { id: organizationId },
            select: { lowStockThreshold: true },
          });
          if (!organization) throw new Error("Organisation nicht gefunden.");
          return organization.lowStockThreshold;
        });
  const where = buildProductWhere(requestedQuery, lowStockThreshold);

  const [totalResults, categoryRows, feeCategoryRows, brandRows] = await Promise.all([
    measureDb("product.count", () => db.product.count({ where })),
    measureDb("product.options.categories", () =>
      db.product.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      })
    ),
    measureDb("product.options.fee_categories", () =>
      db.feeCategory.findMany({
        where: {
          marketplaceCode: { in: ["EBAY_DE", "KAUFLAND_DE"] },
          externalCategoryId: { not: null },
          feeSchedule: { status: "ACTIVE" },
          active: true,
        },
        select: {
          id: true,
          marketplaceCode: true,
          officialName: true,
          externalCategoryId: true,
        },
        orderBy: [{ marketplaceCode: "asc" }, { officialName: "asc" }],
      })
    ),
    measureDb("product.options.brands", () =>
      db.product.findMany({
        where: { brand: { not: null } },
        select: { brand: true },
        distinct: ["brand"],
        orderBy: { brand: "asc" },
      })
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalResults / requestedQuery.pageSize));
  const query = { ...requestedQuery, page: Math.min(requestedQuery.page, totalPages) };
  const [products, selectionRows] = await Promise.all([
    measureDb("product.list.slim", () =>
      db.product.findMany({
        where,
        orderBy: buildProductOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: productListSelect,
      })
    ),
    totalResults <= 5000
      ? measureDb("product.selection_digest_rows", () =>
          db.product.findMany({ where, select: { id: true }, orderBy: { id: "asc" } })
        )
      : Promise.resolve([]),
  ]);

  const rows = mapProductsToOperationalRows(products);
  const categories = categoryRows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));
  const brands = brandRows
    .map((row) => row.brand)
    .filter((value): value is string => Boolean(value));
  const ebayCategories = feeCategoryRows
    .filter((item) => item.marketplaceCode === "EBAY_DE")
    .map((item) => ({
      id: item.id,
      label: item.officialName,
      externalId: item.externalCategoryId ?? "",
    }));
  const kauflandCategories = feeCategoryRows
    .filter((item) => item.marketplaceCode === "KAUFLAND_DE")
    .map((item) => ({
      id: item.id,
      label: item.officialName,
      externalId: item.externalCategoryId ?? "",
    }));
  const allResultDigest =
    totalResults <= 5000
      ? createHash("sha256")
          .update(selectionRows.map((row) => row.id).join("\n"))
          .digest("hex")
      : null;

  return {
    rows,
    totalResults,
    query,
    queryString: productQueryToSearchParams(query).toString(),
    allResultDigest,
    categories,
    brands,
    ebayCategories,
    kauflandCategories,
    rowCounts: {
      products: products.length,
      totalResults,
      categories: categories.length,
      brands: brands.length,
      feeCategories: feeCategoryRows.length,
      selectionRows: selectionRows.length,
      pricingSummaries: products.reduce(
        (sum, product) => sum + product.pricingCalculations.length,
        0
      ),
      digestComputed: allResultDigest ? 1 : 0,
    },
  };
}

export function mapProductsToOperationalRows(
  products: ProductListRecord[],
  pricingSummaries: ProductPricingSummary[] = []
): ProductOperationalRow[] {
  const pricingByProduct = new Map<string, Map<string, ProductPricingSummary>>();
  for (const summary of pricingSummaries) {
    let byMarketplace = pricingByProduct.get(summary.productId);
    if (!byMarketplace) {
      byMarketplace = new Map();
      pricingByProduct.set(summary.productId, byMarketplace);
    }
    if (!byMarketplace.has(summary.marketplaceCode)) {
      byMarketplace.set(summary.marketplaceCode, summary);
    }
  }

  return products.map((product) => {
    const ebayMapping = product.marketplaceMappings.find(
      (item) => item.marketplaceCode === "EBAY_DE"
    );
    const kauflandMapping = product.marketplaceMappings.find(
      (item) => item.marketplaceCode === "KAUFLAND_DE"
    );
    const ebayCalculation = pricingByProduct.get(product.id)?.get("EBAY_DE");
    const kauflandCalculation = pricingByProduct.get(product.id)?.get("KAUFLAND_DE");
    const nestedEbayCalculation =
      ebayCalculation ??
      product.pricingCalculations.find((item) => item.marketplaceCode === "EBAY_DE");
    const nestedKauflandCalculation =
      kauflandCalculation ??
      product.pricingCalculations.find((item) => item.marketplaceCode === "KAUFLAND_DE");

    return {
      id: product.id,
      name: product.name,
      variant: product.variant ?? "",
      brand: product.brand ?? "",
      category: product.category ?? "",
      ean: product.ean ?? "",
      size: product.size ?? "",
      defaultPriceCents: product.defaultPriceCents,
      defaultCondition: product.defaultCondition,
      defaultShippingCostCents: product.defaultShippingCostCents,
      defaultPackagingCostCents: product.defaultPackagingCostCents,
      ebayMapping: ebayMapping
        ? {
            feeCategoryId: ebayMapping.feeCategoryId,
            label: ebayMapping.feeCategory.officialName,
          }
        : null,
      kauflandMapping: kauflandMapping
        ? {
            feeCategoryId: kauflandMapping.feeCategoryId,
            label: kauflandMapping.feeCategory.officialName,
          }
        : null,
      ebayCalculation: nestedEbayCalculation
        ? {
            breakEvenCents: nestedEbayCalculation.breakEvenCents,
            profitCents: nestedEbayCalculation.profitCents,
            status: nestedEbayCalculation.status,
            stale: nestedEbayCalculation.stale,
          }
        : null,
      kauflandCalculation: nestedKauflandCalculation
        ? {
            breakEvenCents: nestedKauflandCalculation.breakEvenCents,
            profitCents: nestedKauflandCalculation.profitCents,
            status: nestedKauflandCalculation.status,
            stale: nestedKauflandCalculation.stale,
          }
        : null,
      imageUrls: product.imageUrls,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      usage: {
        purchases: product._count.purchaseLines,
        inventory: product._count.inventoryPositions,
        sales: product._count.saleLines,
      },
    };
  });
}
