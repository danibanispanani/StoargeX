import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stock UI simplification", () => {
  const table = readFileSync("components/stock/stock-table.tsx", "utf8");
  const receipt = readFileSync("components/stock/stock-item-dialog.tsx", "utf8");

  it("does not offer a manual correction entry", () => {
    expect(table).not.toContain("QuantityAdjustmentDialog");
    expect(table).not.toContain(">Korrektur<");
  });

  it("does not render the new-row marker", () => {
    expect(table).not.toContain(">Neu</span>");
  });

  it("does not render status, purchase-entry, or return-entry fields in goods receipt", () => {
    expect(receipt).not.toContain('name="status"');
    expect(receipt).not.toContain('name="kaufStatus"');
    expect(receipt).not.toContain('name="retoureStatus"');
  });

  it("does not expose the former full legacy editor from the stock table", () => {
    expect(table).not.toContain("<StockItemDialog");
    expect(table).not.toContain('name="quantityAvailable"');
    expect(table).not.toContain('name="purchaseLineId"');
  });
});
