export const STOCK_VIEW_DEFINITION = [
  { key: "standard", label: "Standard" },
  { key: "stock", label: "Bestand" },
  { key: "purchasing", label: "Einkauf" },
  { key: "listings", label: "Listings" },
  { key: "inspection", label: "Prüfung/Defekt" },
  { key: "all", label: "Alle" },
] as const;

export type StockView = (typeof STOCK_VIEW_DEFINITION)[number]["key"];

export function parseStockView(value: string | undefined): StockView {
  return STOCK_VIEW_DEFINITION.some((view) => view.key === value)
    ? value as StockView
    : "standard";
}

export function matchesLowStockFilter(row: {
  low: boolean;
  availableQuantity: number;
}): boolean {
  return row.low && row.availableQuantity > 0;
}
