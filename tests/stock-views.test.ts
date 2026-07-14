import { describe, expect, it } from "vitest";
import { STOCK_VIEW_DEFINITION, parseStockView } from "@/lib/stock/stock-views";

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
});
