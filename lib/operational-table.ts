export type TableDensity = "compact" | "comfortable";

export const MAX_SAVED_TABLE_VIEWS = 20;

export interface SavedTableView {
  id: string;
  name: string;
  query: string;
  density?: TableDensity;
  visibleColumns?: string[];
}

export interface TablePreferences {
  density: TableDensity;
  visibleColumns: string[];
  savedViews: SavedTableView[];
}

export interface TablePreferenceScope {
  organizationId: string;
  userId: string;
  tableKey: string;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type TableSelection =
  | { mode: "explicit"; ids: string[] }
  | { mode: "all"; excludedIds: string[] };

export function tablePreferenceStorageKey(scope: TablePreferenceScope): string {
  return `storagex:table:${scope.organizationId}:${scope.userId}:${scope.tableKey}:v1`;
}

export function loadTablePreferences(
  storage: StorageAdapter,
  key: string,
  options: {
    allowedColumns: readonly string[];
    defaultVisibleColumns: readonly string[];
  }
): TablePreferences {
  const fallback: TablePreferences = {
    density: "comfortable",
    visibleColumns: [...options.defaultVisibleColumns],
    savedViews: [],
  };

  const raw = storage.getItem(key);
  if (!raw) return fallback;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const allowedColumns = new Set(options.allowedColumns);
    const visibleColumns = uniqueStrings(value.visibleColumns).filter((column) =>
      allowedColumns.has(column)
    );
    const savedViews = Array.isArray(value.savedViews)
      ? value.savedViews
          .flatMap((item) => normalizeSavedView(item))
          .slice(-MAX_SAVED_TABLE_VIEWS)
      : [];

    return {
      density: value.density === "compact" ? "compact" : "comfortable",
      visibleColumns:
        visibleColumns.length > 0
          ? visibleColumns
          : [...options.defaultVisibleColumns],
      savedViews,
    };
  } catch {
    return fallback;
  }
}

export function saveTablePreferences(
  storage: StorageAdapter,
  key: string,
  preferences: TablePreferences
): void {
  storage.setItem(
    key,
    JSON.stringify({
      ...preferences,
      savedViews: preferences.savedViews.slice(-MAX_SAVED_TABLE_VIEWS),
    })
  );
}

export function createEmptySelection(): TableSelection {
  return { mode: "explicit", ids: [] };
}

export function selectAllResults(): TableSelection {
  return { mode: "all", excludedIds: [] };
}

export function createSelectionLookup(selection: TableSelection): (rowId: string) => boolean {
  const ids = new Set(selection.mode === "all" ? selection.excludedIds : selection.ids);
  return selection.mode === "all"
    ? (rowId) => !ids.has(rowId)
    : (rowId) => ids.has(rowId);
}

export function toggleSelectedRow(
  selection: TableSelection,
  rowId: string
): TableSelection {
  if (selection.mode === "all") {
    return {
      mode: "all",
      excludedIds: selection.excludedIds.includes(rowId)
        ? selection.excludedIds.filter((id) => id !== rowId)
        : [...selection.excludedIds, rowId],
    };
  }

  return {
    mode: "explicit",
    ids: selection.ids.includes(rowId)
      ? selection.ids.filter((id) => id !== rowId)
      : [...selection.ids, rowId],
  };
}

export function selectPageRows(
  selection: TableSelection,
  rowIds: readonly string[],
  selected: boolean
): TableSelection {
  if (selection.mode === "all") {
    const pageIds = new Set(rowIds);
    return {
      mode: "all",
      excludedIds: selected
        ? selection.excludedIds.filter((id) => !pageIds.has(id))
        : uniqueStrings([...selection.excludedIds, ...rowIds]),
    };
  }

  const ids = new Set(selection.ids);
  rowIds.forEach((id) => (selected ? ids.add(id) : ids.delete(id)));
  return { mode: "explicit", ids: [...ids] };
}

export function selectedRowCount(
  selection: TableSelection,
  totalResults: number
): number {
  return selection.mode === "all"
    ? Math.max(0, totalResults - selection.excludedIds.length)
    : selection.ids.length;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string" && item.length > 0)
    ),
  ];
}

function normalizeSavedView(value: unknown): SavedTableView[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    !item.id ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    typeof item.query !== "string"
  ) {
    return [];
  }
  return [{
    id: item.id,
    name: item.name.trim(),
    query: item.query,
    ...(item.density === "compact" || item.density === "comfortable"
      ? { density: item.density }
      : {}),
    ...(Array.isArray(item.visibleColumns)
      ? { visibleColumns: uniqueStrings(item.visibleColumns) }
      : {}),
  }];
}
