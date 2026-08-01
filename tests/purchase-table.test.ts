import { describe, expect, it } from "vitest";
import {
  buildPurchaseWhere,
  parsePurchaseTableQuery,
  PURCHASE_TABLE_DEFINITION,
} from "@/lib/purchases/purchase-table";

describe("purchase operational table", () => {
  it("stellt alle geforderten modulspezifischen Ansichten bereit", () => {
    expect(PURCHASE_TABLE_DEFINITION.presets.map((preset) => preset.label)).toEqual([
      "Standard",
      "Offen",
      "Unterwegs",
      "Eingetroffen",
      "Rückgabefristen",
      "Finanzen",
      "Alle",
    ]);
  });

  it("normalisiert Suche, Sortierung, Richtung und Datumsbereich", () => {
    expect(
      parsePurchaseTableQuery({
        q: "  Bosch ",
        preset: "in-transit",
        sort: "supplier",
        direction: "desc",
        from: "2026-07-01",
        to: "invalid",
      })
    ).toEqual(expect.objectContaining({
      q: "Bosch",
      preset: "in-transit",
      sort: "supplier",
      direction: "desc",
      from: "2026-07-01",
      to: "",
    }));
  });

  it("verwendet einheitlich 100 Zeilen und akzeptiert bis zu 500", () => {
    expect(parsePurchaseTableQuery({}).pageSize).toBe(100);
    expect(parsePurchaseTableQuery({ pageSize: "500" }).pageSize).toBe(500);
    expect(parsePurchaseTableQuery({ pageSize: "50" }).pageSize).toBe(100);
  });

  it("kombiniert Rückgabefrist-, Lieferanten- und Suchfilter tenant-neutral", () => {
    const query = parsePurchaseTableQuery({
      q: "E-26",
      preset: "deadlines",
      supplier: "partner-a",
    });
    expect(buildPurchaseWhere(query, new Date("2026-07-14T00:00:00.000Z"))).toEqual(
      expect.objectContaining({
        businessPartnerId: "partner-a",
        returnDeadline: { not: null },
        OR: expect.any(Array),
      })
    );
  });

  it("verknüpft die Finanzansicht mit der Suche statt beide Filter zu verbreitern", () => {
    const where = buildPurchaseWhere(parsePurchaseTableQuery({ q: "Bosch", preset: "finance" }));
    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual([
      { OR: expect.any(Array) },
      { debtLinks: { some: {} } },
    ]);
  });
});
