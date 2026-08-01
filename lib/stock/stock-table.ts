const STOCK_SORT_KEYS = [
  "number",
  "date",
  "product",
  "quantity",
  "cost",
  "payment",
  "purchase",
  "return",
  "status",
  "listings",
  "ean",
] as const;

export type StockSort = (typeof STOCK_SORT_KEYS)[number];

export interface StockTableQuery {
  sort: StockSort;
  direction: "asc" | "desc";
}

interface StockSortableRow {
  sku: string;
  dateIso: string;
  title: string;
  variant: string;
  size: string;
  availableQuantity: number;
  netCents: number | null;
  zm: string;
  kaufStatus: string;
  retoureStatus: string;
  status: string;
  derivedStatus?: string;
  listings: string[];
  ean: string;
}

const collator = new Intl.Collator("de", {
  numeric: true,
  sensitivity: "base",
});

export function parseStockTableQuery(params: {
  sort?: string;
  direction?: string;
}): StockTableQuery {
  return {
    sort: STOCK_SORT_KEYS.includes(params.sort as StockSort)
      ? (params.sort as StockSort)
      : "number",
    direction: params.direction === "asc" ? "asc" : "desc",
  };
}

export function sortStockRows<T extends StockSortableRow>(
  rows: readonly T[],
  query: StockTableQuery
): T[] {
  const direction = query.direction === "asc" ? 1 : -1;

  return rows
    .map((row) => ({
      row,
      key: stockSortValue(row, query.sort),
    }))
    .sort((left, right) => {
      const compared = compareValues(left.key, right.key);
      return compared !== 0
        ? compared * direction
        : collator.compare(left.row.sku, right.row.sku) * direction;
    })
    .map(({ row }) => row);
}

function stockSortValue(
  row: StockSortableRow,
  sort: StockSort
): string | number {
  switch (sort) {
    case "number":
      return row.sku;
    case "date":
      return row.dateIso;
    case "product":
      return [row.title, row.variant, row.size].filter(Boolean).join(" ");
    case "quantity":
      return row.availableQuantity;
    case "cost":
      return row.netCents ?? Number.NEGATIVE_INFINITY;
    case "payment":
      return row.zm;
    case "purchase":
      return row.kaufStatus;
    case "return":
      return row.retoureStatus;
    case "status":
      return row.derivedStatus ?? row.status;
    case "listings":
      return `${row.listings.length}:${[...row.listings].sort().join(" ")}`;
    case "ean":
      return row.ean;
  }
}

function compareValues(left: string | number, right: string | number): number {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : collator.compare(String(left), String(right));
}
