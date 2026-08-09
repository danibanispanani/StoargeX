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

  it("offers descriptive product and storage fields in edit mode", () => {
    expect(receipt).not.toContain('name="quantityAvailable"');
    const editor = readFileSync("components/stock/stock-metadata-dialog.tsx", "utf8");
    for (const field of ["productName", "variant", "size", "ean", "location", "notes"]) {
      expect(editor).toContain(`name="${field}"`);
    }
  });

  it("offers condition and managed storage location in manual goods receipt", () => {
    expect(receipt).toContain('name="itemCondition"');
    expect(receipt).toContain("ITEM_CONDITION_OPTIONS");
    expect(receipt).toContain('name="location"');
    expect(receipt).toContain("storageLocations.map");
  });

  it("renders linked product images in the stock details", () => {
    expect(table).toContain('<DetailSection title="Bilder">');
    expect(table).toContain("detailMetadata.imageUrls.map");
    expect(table).toContain("Bilder werden geladen");
  });

  it("manages storage locations in organization settings", () => {
    const settings = readFileSync("app/(app)/einstellungen/page.tsx", "utf8");
    expect(settings).toContain("Lagerstandorte");
    expect(settings).toContain('kind="STORAGE_LOCATION"');
  });

  it("offers the existing purchase-receipt cancellation from stock details", () => {
    const cancellation = readFileSync(
      "components/purchases/purchase-cancellation-actions.tsx",
      "utf8"
    );
    expect(table).toContain("CancelStockQuantityButton");
    expect(cancellation).toContain('type="number"');
    expect(cancellation).toContain("cancelPurchaseReceiptLineQuantityAction");
    expect(cancellation).toContain("Gesamte Restmenge");
  });

  it("offers traceable cancellation for legacy stock from its details", () => {
    expect(table).toContain("CancelLegacyStockItemButton");
    expect(table).toContain('row.source === "legacy" && row.status !== "CANCELLED"');
  });
});
