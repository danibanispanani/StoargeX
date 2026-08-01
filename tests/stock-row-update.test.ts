import { describe, expect, it } from "vitest";
import { applyStockMetadataPatch } from "@/lib/stock/stock-row-update";
import type { StockRow } from "@/components/stock/stock-table";
import type { StockMetadataPatch } from "@/lib/actions/stock";

const row: StockRow = {
  source: "owned",
  id: "position-a",
  lotId: "lot-a",
  sku: "L-26-0001",
  date: "01.08.2026",
  dateIso: "2026-08-01",
  supplier: "Lieferant",
  title: "Alter Titel",
  variant: "Rot",
  size: "L",
  grossCents: 1000,
  netCents: 840,
  inputTaxDeductible: true,
  zm: "Firma",
  kaufStatus: "NN",
  retoureStatus: "NN",
  status: "IN_STOCK",
  derivedStatus: "Verfügbar",
  ean: "123",
  imageUrl: null,
  imageUrls: [],
  itemCondition: null,
  location: null,
  listings: [],
  notes: "",
  low: false,
  availableQuantity: 1,
  originalQuantity: 1,
  returnableQuantity: 1,
  purchaseNumber: "E-26-0001",
  receiptId: "receipt-a",
  receiptCancelled: false,
  receiptLineCount: 1,
  cancellableQuantity: 1,
};

const patch: StockMetadataPatch = {
  id: row.id,
  source: row.source,
  title: "Neuer Titel",
  variant: "Blau",
  size: "M",
  ean: "456",
  itemCondition: "USED",
  imageUrls: ["https://example.test/image.jpg"],
  imageUrl: "https://example.test/image.jpg",
  location: "Regal A",
  notes: "Geprüft",
};

describe("stock row metadata update", () => {
  it("replaces the affected row with the server-confirmed metadata", () => {
    const result = applyStockMetadataPatch([row], patch, "");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining(patch));
    expect(row.title).toBe("Alter Titel");
  });

  it("removes a row that no longer matches the active server search", () => {
    const result = applyStockMetadataPatch([row], patch, "q=Alter%20Titel");

    expect(result).toEqual([]);
  });

  it("keeps the prior row unchanged when another position is returned", () => {
    const result = applyStockMetadataPatch([row], { ...patch, id: "position-b" }, "");

    expect(result).toEqual([row]);
  });
});
