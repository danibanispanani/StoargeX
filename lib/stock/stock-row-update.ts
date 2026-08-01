import type { StockMetadataPatch } from "@/lib/actions/stock";
import type { StockRow } from "@/components/stock/stock-table";

export function applyStockMetadataPatch(
  rows: StockRow[],
  patch: StockMetadataPatch,
  currentQuery: string
): StockRow[] {
  return rows.flatMap((row) => {
    if (row.id !== patch.id || row.source !== patch.source) return [row];
    const updated = { ...row, ...patch };
    return matchesCurrentSearch(updated, currentQuery) ? [updated] : [];
  });
}

function matchesCurrentSearch(row: StockRow, currentQuery: string): boolean {
  const query = new URLSearchParams(currentQuery.replace(/^\?/, ""))
    .get("q")
    ?.trim()
    .toLocaleLowerCase("de-DE");
  if (!query) return true;
  return [row.sku, row.title, row.variant, row.ean, row.supplier]
    .some((value) => value.toLocaleLowerCase("de-DE").includes(query));
}
