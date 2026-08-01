import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_MODULES,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
  validateOperationalModuleDefinition,
  updateOperationalViewQuery,
} from "@/lib/operational-modules";

describe("operational module definitions", () => {
  it("defines every Prompt-8 operational table with valid defaults", () => {
    expect(Object.keys(OPERATIONAL_MODULES)).toEqual([
      "stock",
      "purchasing",
      "sales",
      "customerReturns",
      "supplierReturns",
      "consignment",
      "debts",
      "shipping",
      "imports",
      "credentials",
      "team",
    ]);

    for (const definition of Object.values(OPERATIONAL_MODULES)) {
      expect(validateOperationalModuleDefinition(definition)).toEqual([]);
      expect(definition.views.at(-1)?.value).toBe("all");
    }
  });

  it("keeps module-specific view vocabularies", () => {
    expect(OPERATIONAL_MODULES.stock.views.map((view) => view.value)).toEqual([
      "standard",
      "stock",
      "purchasing",
      "listings",
      "inspection",
      "all",
    ]);
    expect(OPERATIONAL_MODULES.sales.views.map((view) => view.value)).toEqual([
      "standard",
      "finances",
      "shipping",
      "payout",
      "all",
    ]);
    expect(OPERATIONAL_MODULES.consignment.views.map((view) => view.value)).toEqual([
      "standard",
      "partner",
      "stock",
      "sales",
      "payout",
      "all",
    ]);
  });

  it("falls back to a module's default view", () => {
    expect(parseOperationalModuleView(OPERATIONAL_MODULES.debts, "settled")).toBe(
      "settled"
    );
    expect(parseOperationalModuleView(OPERATIONAL_MODULES.debts, "unknown")).toBe(
      "standard"
    );
  });

  it("normalizes and bounds operational search input", () => {
    expect(parseOperationalSearchQuery("  LR-24-001  ")).toBe("LR-24-001");
    expect(parseOperationalSearchQuery("x".repeat(140))).toHaveLength(120);
    expect(parseOperationalSearchQuery(undefined)).toBe("");
  });

  it("updates a module view without losing active filters", () => {
    expect(
      updateOperationalViewQuery(
        "q=jacke&page=4&status=OPEN",
        "preset",
        "finances",
        "standard"
      )
    ).toBe("q=jacke&status=OPEN&preset=finances");
    expect(
      updateOperationalViewQuery(
        "q=jacke&preset=finances",
        "preset",
        "standard",
        "standard"
      )
    ).toBe("q=jacke");
  });
});
