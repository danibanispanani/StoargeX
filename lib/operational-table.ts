export const TABLE_PAGE_SIZES = [100, 200, 500] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];
export const DEFAULT_TABLE_PAGE_SIZE = TABLE_PAGE_SIZES[0];
export const MAX_TABLE_PAGE_SIZE = TABLE_PAGE_SIZES[TABLE_PAGE_SIZES.length - 1];

export const MAX_SAVED_TABLE_VIEWS = 20;

export interface SavedTableView {
  id: string;
  name: string;
  visibleColumns: string[];
  columnFilters: TableColumnFilters;
}

export interface TablePreferences {
  pageSize: TablePageSize;
  visibleColumns: string[];
  columnFilters: TableColumnFilters;
  savedViews: SavedTableView[];
  activeViewId: string | null;
}

export type TableColumnFilters = Record<string, string[]>;
export type TableRowFilterValues = Record<string, readonly string[]>;

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
    requiredColumns?: readonly string[];
  }
): TablePreferences {
  const fallback: TablePreferences = {
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
    visibleColumns: [...options.defaultVisibleColumns],
    columnFilters: {},
    savedViews: [],
    activeViewId: null,
  };

  const raw = storage.getItem(key);
  if (!raw) return fallback;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const allowedColumns = new Set(options.allowedColumns);
    const requiredColumns = new Set(
      (options.requiredColumns ?? []).filter((column) => allowedColumns.has(column))
    );
    const normalizedViews = Array.isArray(value.savedViews)
      ? value.savedViews
          .flatMap((item) => normalizeSavedView(
            item,
            options.allowedColumns,
            requiredColumns
          ))
      : [];
    const savedViews = uniqueRecentViewsById(normalizedViews)
      .slice(-MAX_SAVED_TABLE_VIEWS);
    const activeView =
      typeof value.activeViewId === "string"
        ? savedViews.find((view) => view.id === value.activeViewId) ?? null
        : null;

    return {
      pageSize: parseTablePageSize(value.pageSize),
      visibleColumns: activeView
        ? [...activeView.visibleColumns]
        : [...options.defaultVisibleColumns],
      columnFilters: activeView ? { ...activeView.columnFilters } : {},
      savedViews,
      activeViewId: activeView?.id ?? null,
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
      columnFilters: normalizeColumnFilters(
        preferences.columnFilters,
        new Set(preferences.visibleColumns.concat(Object.keys(preferences.columnFilters)))
      ),
      savedViews: preferences.savedViews.slice(-MAX_SAVED_TABLE_VIEWS),
    })
  );
}

export function normalizeTableFilterValue(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || "Leer";
}

export function parseTablePageSize(value: unknown): TablePageSize {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return TABLE_PAGE_SIZES.includes(parsed as TablePageSize)
    ? parsed as TablePageSize
    : DEFAULT_TABLE_PAGE_SIZE;
}

export function normalizeTableFilterValues(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeTableFilterValue))];
}

export function filterColumnFiltersByVisibleColumns(
  filters: TableColumnFilters,
  visibleColumns: readonly string[]
): TableColumnFilters {
  const visible = new Set(visibleColumns);
  return Object.fromEntries(
    Object.entries(filters).filter(([columnKey]) => visible.has(columnKey))
  );
}

export function matchesTableColumnFilters(
  row: TableRowFilterValues,
  filters: TableColumnFilters
): boolean {
  return Object.entries(filters).every(([columnKey, selectedValues]) => {
    if (selectedValues.length === 0) return false;
    const selected = new Set(selectedValues.map(normalizeTableFilterValue));
    const rowValues = row[columnKey] ?? [];
    return rowValues.some((value) => selected.has(normalizeTableFilterValue(value)));
  });
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

function normalizeColumnFilters(
  value: unknown,
  allowedColumns: ReadonlySet<string>
): TableColumnFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const filters: TableColumnFilters = {};
  for (const [columnKey, selectedValues] of Object.entries(value)) {
    if (!allowedColumns.has(columnKey) || !Array.isArray(selectedValues)) continue;
    filters[columnKey] = normalizeTableFilterValues(
      selectedValues.filter((item): item is string => typeof item === "string")
    ).slice(0, 500);
  }
  return filters;
}

function normalizeSavedView(
  value: unknown,
  allowedColumns: readonly string[],
  requiredColumns: ReadonlySet<string>
): SavedTableView[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const requestedColumns = new Set(uniqueStrings(item.visibleColumns));
  const visibleColumns = allowedColumns.filter((column) =>
    requiredColumns.has(column) || requestedColumns.has(column)
  );
  if (
    typeof item.id !== "string" ||
    !item.id ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    visibleColumns.length === 0
  ) {
    return [];
  }
  const visibleColumnSet = new Set(visibleColumns);
  return [{
    id: item.id,
    name: item.name.trim(),
    visibleColumns,
    columnFilters: normalizeColumnFilters(item.columnFilters, visibleColumnSet),
  }];
}

function uniqueRecentViewsById(views: readonly SavedTableView[]): SavedTableView[] {
  const seen = new Set<string>();
  const uniqueReversed = [...views].reverse().filter((view) => {
    if (seen.has(view.id)) return false;
    seen.add(view.id);
    return true;
  });
  return uniqueReversed.reverse();
}
