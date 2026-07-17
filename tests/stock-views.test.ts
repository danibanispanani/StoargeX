import { describe, expect, it } from "vitest";
import {
  matchesLowStockFilter,
  STOCK_VIEW_DEFINITION,
  parseStockView,
} from "@/lib/stock/stock-views";

describe("stock operational views", () => {
  it("enthält die geforderten Lageransichten", () => {
    expect(STOCK_VIEW_DEFINITION.map((view) => view.label)).toEqual([
      "Standard", "Bestand", "Einkauf", "Listings", "Prüfung/Defekt", "Alle",
    ]);
  });
  it("fällt bei unbekannten Ansichten sicher auf Standard zurück", () => {
    expect(parseStockView("unknown")).toBe("standard");
    expect(parseStockView("inspection")).toBe("inspection");
  });
  it("zeigt im Dashboard-Drill-down nur verfügbare Niedrigbestände", () => {
    expect(matchesLowStockFilter({ low: true, availableQuantity: 1 })).toBe(true);
    expect(matchesLowStockFilter({ low: true, availableQuantity: 0 })).toBe(false);
    expect(matchesLowStockFilter({ low: false, availableQuantity: 1 })).toBe(false);
  });
});
