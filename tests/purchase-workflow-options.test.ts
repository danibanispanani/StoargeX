import { describe, expect, it } from "vitest";
import {
  DEFAULT_PURCHASE_STATUS,
  PURCHASE_SHIPPING_STATUS_VALUES,
  PURCHASE_STATUS_VALUES,
  RETURN_WINDOW_DAYS,
} from "@/lib/purchases/purchase-workflow";

describe("purchase workflow options", () => {
  it("bietet nur die manuell erlaubten Bestell- und Versandstatus an", () => {
    expect(DEFAULT_PURCHASE_STATUS).toBe("CONFIRMED");
    expect(PURCHASE_STATUS_VALUES).toEqual([
      "CONFIRMED",
      "ORDERED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
    ]);
    expect(PURCHASE_SHIPPING_STATUS_VALUES).toEqual([
      "NOT_SHIPPED",
      "SHIPPED",
      "PARTIALLY_RECEIVED",
      "DELIVERED",
      "UNKNOWN",
    ]);
  });

  it("begrenzt die Rückgabefrist auf 14 oder 30 Tage", () => {
    expect(RETURN_WINDOW_DAYS).toEqual([14, 30]);
  });
});
