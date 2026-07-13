import { describe, expect, it } from "vitest";
import {
  createEmptySelection,
  createSelectionLookup,
  loadTablePreferences,
  MAX_SAVED_TABLE_VIEWS,
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

  it("round-trips density, columns and named views through the storage adapter", () => {
    const storage = new MemoryStorage();
    const key = "products";

    saveTablePreferences(storage, key, {
      density: "compact",
      visibleColumns: ["name", "ean"],
      savedViews: [
        { id: "view-1", name: "Elektronik", query: "preset=catalog&category=Elektronik" },
      ],
    });

    expect(loadTablePreferences(storage, key, preferenceOptions)).toEqual({
      density: "compact",
      visibleColumns: ["name", "ean"],
      savedViews: [
        { id: "view-1", name: "Elektronik", query: "preset=catalog&category=Elektronik" },
      ],
    });
  });

  it("rejects unknown columns and malformed persisted values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "products",
      JSON.stringify({
        density: "tiny",
        visibleColumns: ["foreign"],
        savedViews: [{ id: "", name: "", query: 12 }],
      })
    );

    expect(loadTablePreferences(storage, "products", preferenceOptions)).toEqual({
      density: "comfortable",
      visibleColumns: ["name", "category"],
      savedViews: [],
    });
  });

  it("caps persisted named views to a bounded recent set", () => {
    const storage = new MemoryStorage();
    saveTablePreferences(storage, "products", {
      density: "comfortable",
      visibleColumns: ["name"],
      savedViews: Array.from({ length: MAX_SAVED_TABLE_VIEWS + 3 }, (_, index) => ({
        id: `view-${index}`,
        name: `Ansicht ${index}`,
        query: `q=${index}`,
      })),
    });

    const loaded = loadTablePreferences(storage, "products", preferenceOptions);
    expect(loaded.savedViews).toHaveLength(MAX_SAVED_TABLE_VIEWS);
    expect(loaded.savedViews[0]?.id).toBe("view-3");
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
