import { describe, expect, it } from "vitest";
import {
  parseStockTableQuery,
  sortStockRows,
} from "@/lib/stock/stock-table";

const rows = [
  {
    sku: "L-26-2",
    dateIso: "2026-07-08",
    title: "Zahnbürste",
    variant: "Blau",
    size: "",
    availableQuantity: 1,
    netCents: 1200,
    zm: "Firma B",
    kaufStatus: "NN",
    retoureStatus: "NN",
    status: "IN_STOCK",
    derivedStatus: "Verfügbar",
    listings: ["b"],
    ean: "2",
  },
  {
    sku: "L-26-10",
    dateIso: "2026-07-07",
    title: "Akkusauger",
    variant: "Rot",
    size: "",
    availableQuantity: 4,
    netCents: 7400,
    zm: "Firma A",
    kaufStatus: "Y",
    retoureStatus: "S",
    status: "IN_STOCK",
    derivedStatus: "Verfügbar",
    listings: [],
    ean: "10",
  },
];

describe("stock table sorting", () => {
  it("normalizes unknown sort parameters to the newest inventory number", () => {
    expect(parseStockTableQuery({ sort: "unknown", direction: "sideways" })).toEqual({
      sort: "number",
      direction: "desc",
    });
  });

  it("sorts text columns in both directions", () => {
    expect(
      sortStockRows(rows, { sort: "product", direction: "asc" }).map(
        (row) => row.title
      )
    ).toEqual(["Akkusauger", "Zahnbürste"]);
    expect(
      sortStockRows(rows, { sort: "product", direction: "desc" }).map(
        (row) => row.title
      )
    ).toEqual(["Zahnbürste", "Akkusauger"]);
  });

  it("sorts numeric inventory values without mutating the source rows", () => {
    const sorted = sortStockRows(rows, { sort: "quantity", direction: "desc" });

    expect(sorted.map((row) => row.availableQuantity)).toEqual([4, 1]);
    expect(rows.map((row) => row.availableQuantity)).toEqual([1, 4]);
  });
});
