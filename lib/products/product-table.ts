import type { Prisma } from "@prisma/client";
import type { TableSelection } from "@/lib/operational-table";

export const PRODUCT_TABLE_DEFINITION = {
  key: "products",
  path: "/produkte",
  columns: [
    { key: "name", label: "Produkt", defaultVisible: true, sortable: true },
    { key: "variant", label: "Variante", defaultVisible: true, sortable: true },
    { key: "category", label: "Kategorie", defaultVisible: true, sortable: true },
    { key: "brand", label: "Marke", defaultVisible: true, sortable: true },
    { key: "usage", label: "Nutzung", defaultVisible: true, sortable: false },
    { key: "ean", label: "EAN", defaultVisible: false, sortable: true },
    { key: "defaultPrice", label: "Standard-EK", defaultVisible: false, sortable: true },
    { key: "size", label: "Größe", defaultVisible: false, sortable: true },
    { key: "images", label: "Bilder", defaultVisible: false, sortable: false },
    { key: "updatedAt", label: "Geändert", defaultVisible: false, sortable: true },
  ],
  presets: [
    { key: "catalog", label: "Katalog" },
    { key: "used", label: "Verwendet" },
    { key: "unused", label: "Unbenutzt" },
    { key: "low-stock", label: "Niedriger Bestand" },
  ],
  pageSizes: [25, 50, 100],
} as const;

export type ProductColumnKey = (typeof PRODUCT_TABLE_DEFINITION.columns)[number]["key"];
export type ProductPresetKey = (typeof PRODUCT_TABLE_DEFINITION.presets)[number]["key"];
export type ProductSortKey = Extract<
  (typeof PRODUCT_TABLE_DEFINITION.columns)[number],
  { readonly sortable: true }
>["key"];
export type SortDirection = "asc" | "desc";

export interface ProductTableQuery {
  q: string;
  category: string;
  brand: string;
  from: string;
  to: string;
  preset: ProductPresetKey;
  sort: ProductSortKey;
  direction: SortDirection;
  page: number;
  pageSize: (typeof PRODUCT_TABLE_DEFINITION.pageSizes)[number];
}

type SearchParams = Record<string, string | string[] | undefined>;

export function parseProductTableQuery(params: SearchParams): ProductTableQuery {
  const sortKeys = new Set<string>(
    PRODUCT_TABLE_DEFINITION.columns
      .filter((column) => column.sortable)
      .map((column) => column.key)
  );
  const presets = new Set<string>(
    PRODUCT_TABLE_DEFINITION.presets.map((preset) => preset.key)
  );
  const requestedPageSize = positiveInt(valueOf(params.pageSize));

  return {
    q: valueOf(params.q).trim(),
    category: valueOf(params.category).trim(),
    brand: valueOf(params.brand).trim(),
    from: validIsoDate(valueOf(params.from)),
    to: validIsoDate(valueOf(params.to)),
    preset: presets.has(valueOf(params.preset))
      ? (valueOf(params.preset) as ProductPresetKey)
      : "catalog",
    sort: sortKeys.has(valueOf(params.sort))
      ? (valueOf(params.sort) as ProductSortKey)
      : "name",
    direction: valueOf(params.direction) === "desc" ? "desc" : "asc",
    page: positiveInt(valueOf(params.page)) || 1,
    pageSize: PRODUCT_TABLE_DEFINITION.pageSizes.includes(
      requestedPageSize as ProductTableQuery["pageSize"]
    )
      ? (requestedPageSize as ProductTableQuery["pageSize"])
      : 25,
  };
}

export function buildProductWhere(
  query: ProductTableQuery,
  lowStockThreshold: number
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (query.category) {
    and.push({ category: { equals: query.category, mode: "insensitive" } });
  }
  if (query.brand) {
    and.push({ brand: { equals: query.brand, mode: "insensitive" } });
  }
  if (query.from) {
    and.push({ updatedAt: { gte: new Date(`${query.from}T00:00:00.000Z`) } });
  }
  if (query.to) {
    and.push({ updatedAt: { lte: new Date(`${query.to}T23:59:59.999Z`) } });
  }

  if (query.preset === "used") {
    and.push({
      OR: [
        { purchaseLines: { some: {} } },
        { inventoryPositions: { some: {} } },
        { saleLines: { some: {} } },
      ],
    });
  } else if (query.preset === "unused") {
    and.push({
      purchaseLines: { none: {} },
      inventoryPositions: { none: {} },
      saleLines: { none: {} },
    });
  } else if (query.preset === "low-stock") {
    and.push({
      inventoryPositions: {
        some: { active: true, quantityAvailable: { lte: lowStockThreshold } },
      },
    });
  }

  return {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { variant: { contains: query.q, mode: "insensitive" as const } },
            { category: { contains: query.q, mode: "insensitive" as const } },
            { brand: { contains: query.q, mode: "insensitive" as const } },
            { ean: { contains: query.q } },
          ],
        }
      : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

export function buildProductSelectionWhere(
  query: ProductTableQuery,
  selection: TableSelection,
  lowStockThreshold: number
): Prisma.ProductWhereInput {
  const base = buildProductWhere(query, lowStockThreshold);
  const selectionWhere: Prisma.ProductWhereInput | null =
    selection.mode === "explicit"
      ? { id: { in: selection.ids } }
      : selection.excludedIds.length > 0
        ? { id: { notIn: selection.excludedIds } }
        : null;

  return selectionWhere
    ? {
        ...base,
        AND: [...asWhereArray(base.AND), selectionWhere],
      }
    : base;
}

export function buildProductOrderBy(
  query: ProductTableQuery
): Prisma.ProductOrderByWithRelationInput[] {
  const field: keyof Prisma.ProductOrderByWithRelationInput =
    query.sort === "defaultPrice"
      ? "defaultPriceCents"
      : query.sort;
  const order: Prisma.ProductOrderByWithRelationInput[] = [
    { [field]: query.direction },
  ];
  if (query.sort === "name") order.push({ variant: query.direction });
  order.push({ id: "asc" });
  return order;
}

export function productQueryToSearchParams(query: ProductTableQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.brand) params.set("brand", query.brand);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.preset !== "catalog") params.set("preset", query.preset);
  if (query.sort !== "name") params.set("sort", query.sort);
  if (query.direction !== "asc") params.set("direction", query.direction);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  return params;
}

function valueOf(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function validIsoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function asWhereArray(
  value: Prisma.ProductWhereInput | Prisma.ProductWhereInput[] | undefined
): Prisma.ProductWhereInput[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
