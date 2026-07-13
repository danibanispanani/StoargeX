import { createHash } from "crypto";
import { requireOrg } from "@/lib/org";
import {
  buildProductOrderBy,
  buildProductWhere,
  parseProductTableQuery,
  productQueryToSearchParams,
} from "@/lib/products/product-table";
import { PageHeader } from "@/components/app/page-header";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ProductDialog } from "@/components/products/product-dialog";
import { ProductFilterBar } from "@/components/products/product-filter-bar";
import {
  ProductTable,
  type ProductOperationalRow,
} from "@/components/products/product-table";

type ProductSearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  const { db, organization, userId } = await requireOrg();
  const rawParams = await searchParams;
  const requestedQuery = parseProductTableQuery(rawParams);
  const where = buildProductWhere(requestedQuery, organization.lowStockThreshold);

  const [totalResults, categoryRows, brandRows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    db.product.findMany({
      where: { brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalResults / requestedQuery.pageSize));
  const query = {
    ...requestedQuery,
    page: Math.min(requestedQuery.page, totalPages),
  };
  const [products, selectionRows] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: buildProductOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        _count: {
          select: {
            purchaseLines: true,
            inventoryPositions: true,
            saleLines: true,
          },
        },
      },
    }),
    totalResults <= 5000
      ? db.product.findMany({ where, select: { id: true }, orderBy: { id: "asc" } })
      : Promise.resolve([]),
  ]);

  const rows: ProductOperationalRow[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    variant: product.variant ?? "",
    brand: product.brand ?? "",
    category: product.category ?? "",
    ean: product.ean ?? "",
    size: product.size ?? "",
    defaultPriceCents: product.defaultPriceCents,
    imageUrls: product.imageUrls,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    usage: {
      purchases: product._count.purchaseLines,
      inventory: product._count.inventoryPositions,
      sales: product._count.saleLines,
    },
  }));
  const categories = categoryRows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));
  const brands = brandRows
    .map((row) => row.brand)
    .filter((value): value is string => Boolean(value));
  const queryString = productQueryToSearchParams(query).toString();
  const allResultDigest =
    totalResults <= 5000
      ? createHash("sha256")
          .update(selectionRows.map((row) => row.id).join("\n"))
          .digest("hex")
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Handel / Katalog"
        title="Produkte"
        description={`${totalResults} Treffer · serverseitig gefiltert und sortiert`}
        actions={
          <>
            <ImportExportBar table="produkte" />
            <ProductDialog />
          </>
        }
      />

      <ProductFilterBar query={query} categories={categories} brands={brands} />

      <ProductTable
        rows={rows}
        totalResults={totalResults}
        query={query}
        queryString={queryString}
        allResultDigest={allResultDigest}
        categories={categories}
        scope={{
          organizationId: organization.id,
          userId,
          tableKey: "products",
        }}
      />
    </div>
  );
}
