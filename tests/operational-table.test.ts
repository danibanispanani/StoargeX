import { describe, expect, it } from "vitest";
import {
  createEmptySelection,
  createSelectionLookup,
  filterColumnFiltersByVisibleColumns,
  loadTablePreferences,
  matchesTableColumnFilters,
  MAX_SAVED_TABLE_VIEWS,
  normalizeTableFilterValue,
  parseTablePageSize,
  saveTablePreferences,
  selectAllResults,
  selectPageRows,
  selectedRowCount,
  tablePreferenceStorageKey,
  toggleSelectedRow,
} from "@/lib/operational-table";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const preferenceOptions = {
  allowedColumns: ["name", "category", "ean"],
  defaultVisibleColumns: ["name", "category"],
  requiredColumns: ["name"],
} as const;

describe("operational table preferences", () => {
  it("scopes persisted views by organization, user and table", () => {
    expect(
      tablePreferenceStorageKey({
        organizationId: "org-a",
        userId: "user-a",
        tableKey: "products",
      })
    ).toBe("storagex:table:org-a:user-a:products:v1");
  });

  it("round-trips columns, filters and the active named view through storage", () => {
    const storage = new MemoryStorage();
    const key = "products";

    saveTablePreferences(storage, key, {
      pageSize: 200,
      visibleColumns: ["name", "ean"],
      columnFilters: {
        category: ["Elektronik", "Schuhe"],
        foreign: ["unzulässig"],
      },
      savedViews: [
        {
          id: "view-1",
          name: "Elektronik",
          visibleColumns: ["name", "category", "ean"],
          columnFilters: { category: ["Elektronik"] },
        },
      ],
      activeViewId: "view-1",
    });

    expect(loadTablePreferences(storage, key, preferenceOptions)).toEqual({
      pageSize: 200,
      visibleColumns: ["name", "category", "ean"],
      columnFilters: { category: ["Elektronik"] },
      savedViews: [
        {
          id: "view-1",
          name: "Elektronik",
          visibleColumns: ["name", "category", "ean"],
          columnFilters: { category: ["Elektronik"] },
        },
      ],
      activeViewId: "view-1",
    });
  });

  it("rejects unknown columns and malformed persisted values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "products",
      JSON.stringify({
        density: "tiny",
        visibleColumns: ["foreign"],
        savedViews: [{ id: "", name: "", visibleColumns: ["foreign"] }],
        activeViewId: "missing-view",
      })
    );

    expect(loadTablePreferences(storage, "products", preferenceOptions)).toEqual({
      pageSize: 100,
      visibleColumns: ["name", "category"],
      columnFilters: {},
      savedViews: [],
      activeViewId: null,
    });
  });

  it("caps persisted named views to a bounded recent set", () => {
    const storage = new MemoryStorage();
    saveTablePreferences(storage, "products", {
      pageSize: 100,
      visibleColumns: ["name"],
      columnFilters: {},
      savedViews: Array.from({ length: MAX_SAVED_TABLE_VIEWS + 3 }, (_, index) => ({
        id: `view-${index}`,
        name: `Ansicht ${index}`,
        visibleColumns: ["name"],
        columnFilters: {},
      })),
      activeViewId: null,
    });

    const loaded = loadTablePreferences(storage, "products", preferenceOptions);
    expect(loaded.savedViews).toHaveLength(MAX_SAVED_TABLE_VIEWS);
    expect(loaded.savedViews[0]?.id).toBe("view-3");
  });

  it("loads the immutable standard view when no custom view is active", () => {
    const storage = new MemoryStorage();
    storage.setItem("products", JSON.stringify({
      pageSize: 500,
      visibleColumns: ["name", "ean"],
      columnFilters: { ean: ["123"] },
      savedViews: [{
        id: "view-1",
        name: "EAN-Prüfung",
        visibleColumns: ["name", "ean"],
        columnFilters: { ean: ["123"] },
      }],
      activeViewId: null,
    }));

    expect(loadTablePreferences(storage, "products", preferenceOptions)).toEqual({
      pageSize: 500,
      visibleColumns: ["name", "category"],
      columnFilters: {},
      savedViews: [{
        id: "view-1",
        name: "EAN-Prüfung",
        visibleColumns: ["name", "ean"],
        columnFilters: { ean: ["123"] },
      }],
      activeViewId: null,
    });
  });

  it("repairs duplicate view IDs and restores required columns", () => {
    const storage = new MemoryStorage();
    storage.setItem("products", JSON.stringify({
      savedViews: [
        {
          id: "duplicate",
          name: "Alt",
          visibleColumns: ["category"],
          columnFilters: { category: ["Alt"] },
        },
        {
          id: "duplicate",
          name: "Neu",
          visibleColumns: ["ean"],
          columnFilters: { ean: ["123"] },
        },
      ],
      activeViewId: "duplicate",
    }));

    const loaded = loadTablePreferences(storage, "products", preferenceOptions);
    expect(loaded.savedViews).toEqual([{
      id: "duplicate",
      name: "Neu",
      visibleColumns: ["name", "ean"],
      columnFilters: { ean: ["123"] },
    }]);
    expect(loaded.visibleColumns).toEqual(["name", "ean"]);
    expect(loaded.columnFilters).toEqual({ ean: ["123"] });
  });
});

describe("operational table column filters", () => {
  it("combines several columns with AND and several values within a column with OR", () => {
    const row = {
      category: ["Elektronik"],
      status: ["Aktiv"],
      platform: ["eBay", "Kaufland"],
    };

    expect(matchesTableColumnFilters(row, {
      category: ["Elektronik", "Schuhe"],
      status: ["Aktiv"],
    })).toBe(true);
    expect(matchesTableColumnFilters(row, {
      category: ["Elektronik"],
      status: ["Inaktiv"],
    })).toBe(false);
    expect(matchesTableColumnFilters(row, { platform: ["Kaufland"] })).toBe(true);
  });

  it("treats an explicitly empty selection as no matching rows", () => {
    expect(matchesTableColumnFilters({ category: ["Elektronik"] }, { category: [] })).toBe(false);
  });

  it("normalizes whitespace and gives empty cells a selectable label", () => {
    expect(normalizeTableFilterValue("  Teilweise\n  eingegangen ")).toBe("Teilweise eingegangen");
    expect(normalizeTableFilterValue("  ")).toBe("Leer");
  });

  it("keeps only filters for columns included in a saved view", () => {
    expect(filterColumnFiltersByVisibleColumns({
      category: ["Elektronik"],
      brand: ["Acme"],
    }, ["category"])).toEqual({ category: ["Elektronik"] });
  });
});

describe("operational table page sizes", () => {
  it("accepts configured numeric and serialized page sizes", () => {
    expect(parseTablePageSize(100)).toBe(100);
    expect(parseTablePageSize("200")).toBe(200);
    expect(parseTablePageSize(500)).toBe(500);
  });

  it("falls back to 100 for unsupported values", () => {
    expect(parseTablePageSize(25)).toBe(100);
    expect(parseTablePageSize("all")).toBe(100);
    expect(parseTablePageSize(undefined)).toBe(100);
  });
});

describe("operational table selection", () => {
  it("selects and deselects explicit page rows", () => {
    let selection = selectPageRows(createEmptySelection(), ["p1", "p2"], true);
    expect(selection).toEqual({ mode: "explicit", ids: ["p1", "p2"] });
    expect(createSelectionLookup(selection)("p2")).toBe(true);

    selection = toggleSelectedRow(selection, "p1");
    expect(selection).toEqual({ mode: "explicit", ids: ["p2"] });
  });

  it("supports select-all for the current filtered result with exclusions", () => {
    let selection = selectAllResults();
    expect(selectedRowCount(selection, 240)).toBe(240);
    expect(createSelectionLookup(selection)("p99")).toBe(true);

    selection = toggleSelectedRow(selection, "p99");
    expect(selection).toEqual({ mode: "all", excludedIds: ["p99"] });
    expect(selectedRowCount(selection, 240)).toBe(239);
    expect(createSelectionLookup(selection)("p99")).toBe(false);
    expect(createSelectionLookup(selection)("p100")).toBe(true);
  });

  it("deselects and restores a page while all filtered results are selected", () => {
    let selection = selectPageRows(selectAllResults(), ["p1", "p2"], false);
    expect(selection).toEqual({ mode: "all", excludedIds: ["p1", "p2"] });
    expect(selectedRowCount(selection, 10)).toBe(8);

    selection = selectPageRows(selection, ["p1", "p2"], true);
    expect(selection).toEqual({ mode: "all", excludedIds: [] });
    expect(selectedRowCount(selection, 10)).toBe(10);
  });
});
