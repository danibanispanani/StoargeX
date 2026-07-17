import { describe, expect, it } from "vitest";
import {
  IMPORT_REVIEW_STATUSES,
  importTargetHref,
  importTargetLabel,
} from "@/lib/imports/import-review";

describe("import review drill-down", () => {
  it("uses only actionable review statuses", () => {
    expect(IMPORT_REVIEW_STATUSES).toEqual([
      "CONFLICT",
      "ERROR",
      "REVIEW_REQUIRED",
      "UNRESOLVED",
    ]);
  });

  it("routes source references back to their existing operational module", () => {
    expect(importTargetHref("PRODUCT", "SKU 17")).toBe("/produkte?q=SKU%2017");
    expect(importTargetHref("SUPPLIER_RETURN", "LR-26-0001")).toBe(
      "/retouren/lieferanten?q=LR-26-0001"
    );
    expect(importTargetHref("SALE_LINE", null)).toBe("/verkauf");
    expect(importTargetLabel("INVENTORY_POSITION")).toBe("Inventory Position");
  });
});
