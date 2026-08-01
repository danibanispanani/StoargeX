"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Columns3Icon } from "lucide-react";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  MAX_SAVED_TABLE_VIEWS,
  createEmptySelection,
  createSelectionLookup,
  filterColumnFiltersByVisibleColumns,
  loadTablePreferences,
  normalizeTableFilterValues,
  saveTablePreferences,
  selectAllResults,
  selectPageRows,
  selectedRowCount,
  tablePreferenceStorageKey,
  toggleSelectedRow,
  type SavedTableView,
  type TableColumnFilters,
  type TablePreferenceScope,
  type TablePreferences,
  type TablePageSize,
  type TableSelection,
} from "@/lib/operational-table";
import { Button } from "@/components/ui/button";
import { ColumnFilterLayer } from "@/components/table/column-filter-layer";
import { ClientOperationalPagination } from "@/components/table/operational-pagination";
import { TableViewManager } from "@/components/table/table-view-manager";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface OperationalColumnOption {
  key: string;
  label: string;
  required?: boolean;
  filterable?: boolean;
}

export interface OperationalTableRenderState {
  visibleColumns: ReadonlySet<string>;
  selection: TableSelection;
  isSelected: (rowId: string) => boolean;
  toggleRow: (rowId: string) => void;
  pageSelection: boolean | "indeterminate";
  togglePage: (selected: boolean) => void;
  clearSelection: () => void;
}

export function OperationalTableWorkspace({
  scope,
  columns,
  defaultVisibleColumns,
  pageRowIds,
  totalResults,
  currentQuery,
  renderTable,
  renderBulkActions,
  clientPagination = false,
}: {
  scope: TablePreferenceScope;
  columns: readonly OperationalColumnOption[];
  defaultVisibleColumns: readonly string[];
  pageRowIds: readonly string[];
  totalResults: number;
  currentQuery: string;
  renderTable: (state: OperationalTableRenderState) => ReactNode;
  renderBulkActions?: (
    selection: TableSelection,
    selectedCount: number,
    clearSelection: () => void
  ) => ReactNode;
  clientPagination?: boolean;
}) {
  const [workspaceRoot, setWorkspaceRoot] = useState<HTMLElement | null>(null);
  const storageKey = tablePreferenceStorageKey(scope);
  const allowedColumns = useMemo(() => columns.map((column) => column.key), [columns]);
  const requiredColumns = useMemo(
    () => columns.filter((column) => column.required).map((column) => column.key),
    [columns]
  );
  const [preferences, setPreferences] = useState<TablePreferences>({
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
    visibleColumns: [...defaultVisibleColumns],
    columnFilters: {},
    savedViews: [],
    activeViewId: null,
  });
  const [selection, setSelection] = useState<TableSelection>(createEmptySelection());
  const [matchingPageRowIds, setMatchingPageRowIds] = useState<string[]>([]);
  const [matchingRowCount, setMatchingRowCount] = useState(0);
  const [clientPage, setClientPage] = useState(1);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    setPreferencesLoaded(false);
    const loaded = loadTablePreferences(window.localStorage, storageKey, {
      allowedColumns,
      defaultVisibleColumns,
      requiredColumns,
    });
    const visible = new Set(loaded.visibleColumns);
    setPreferences({
      ...loaded,
      columnFilters: Object.fromEntries(
        Object.entries(loaded.columnFilters).filter(([columnKey]) => visible.has(columnKey))
      ),
    });
    setPreferencesLoaded(true);
  }, [allowedColumns, defaultVisibleColumns, requiredColumns, storageKey]);

  useEffect(() => {
    setSelection(createEmptySelection());
    setClientPage(1);
  }, [currentQuery, storageKey]);

  useEffect(() => {
    if (!clientPagination) return;
    const totalPages = Math.max(1, Math.ceil(matchingRowCount / preferences.pageSize));
    if (clientPage > totalPages) setClientPage(totalPages);
  }, [clientPage, clientPagination, matchingRowCount, preferences.pageSize]);

  function updatePreferences(next: TablePreferences) {
    setPreferences(next);
    saveTablePreferences(window.localStorage, storageKey, next);
  }

  function setColumn(column: OperationalColumnOption, visible: boolean) {
    if (column.required && !visible) return;
    if (preferences.visibleColumns.includes(column.key) === visible) return;
    const next = new Set(preferences.visibleColumns);
    if (visible) next.add(column.key);
    else next.delete(column.key);
    const columnFilters = { ...preferences.columnFilters };
    if (!visible) delete columnFilters[column.key];
    updatePreferences(withUpdatedActiveView(
      preferences,
      [...next],
      columnFilters
    ));
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function setColumnFilter(columnKey: string, selectedValues: string[] | null) {
    const normalized = selectedValues === null
      ? null
      : normalizeTableFilterValues(selectedValues).sort();
    const current = preferences.columnFilters[columnKey];
    if (
      (normalized === null && current === undefined) ||
      (normalized !== null && current !== undefined && sameStringValues(current, normalized))
    ) return;
    const columnFilters = { ...preferences.columnFilters };
    if (normalized === null) delete columnFilters[columnKey];
    else columnFilters[columnKey] = normalized;
    updatePreferences(withUpdatedActiveView(
      preferences,
      preferences.visibleColumns,
      columnFilters
    ));
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function clearColumnFilters() {
    if (Object.keys(preferences.columnFilters).length === 0) return;
    updatePreferences(withUpdatedActiveView(
      preferences,
      preferences.visibleColumns,
      {}
    ));
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function selectTableView(viewId: string | null) {
    const view = viewId
      ? preferences.savedViews.find((candidate) => candidate.id === viewId)
      : null;
    const next = view
      ? {
          ...preferences,
          activeViewId: view.id,
          visibleColumns: [...view.visibleColumns],
          columnFilters: { ...view.columnFilters },
        }
      : {
          ...preferences,
          activeViewId: null,
          visibleColumns: [...defaultVisibleColumns],
          columnFilters: {},
        };
    if (
      preferences.activeViewId === next.activeViewId &&
      sameStringValues(preferences.visibleColumns, next.visibleColumns) &&
      sameColumnFilters(preferences.columnFilters, next.columnFilters)
    ) return;
    updatePreferences(next);
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function saveTableView(view: SavedTableView) {
    const requestedColumns = new Set(view.visibleColumns);
    const visibleColumns = columns
      .filter((column) => column.required || requestedColumns.has(column.key))
      .map((column) => column.key);
    const normalizedView: SavedTableView = {
      ...view,
      name: view.name.trim(),
      visibleColumns,
      columnFilters: filterColumnFiltersByVisibleColumns(
        view.columnFilters,
        visibleColumns
      ),
    };
    const existingIndex = preferences.savedViews.findIndex(
      (candidate) => candidate.id === view.id
    );
    const savedViews = existingIndex >= 0
      ? preferences.savedViews.map((candidate, index) =>
          index === existingIndex ? normalizedView : candidate
        )
      : [...preferences.savedViews, normalizedView].slice(-MAX_SAVED_TABLE_VIEWS);
    const next = {
      ...preferences,
      savedViews,
      activeViewId: normalizedView.id,
      visibleColumns: [...normalizedView.visibleColumns],
      columnFilters: { ...normalizedView.columnFilters },
    };
    const existingView = existingIndex >= 0
      ? preferences.savedViews[existingIndex]
      : null;
    if (
      existingView &&
      preferences.activeViewId === normalizedView.id &&
      sameSavedView(existingView, normalizedView) &&
      sameStringValues(preferences.visibleColumns, normalizedView.visibleColumns) &&
      sameColumnFilters(preferences.columnFilters, normalizedView.columnFilters)
    ) return;
    updatePreferences(next);
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function deleteTableView(viewId: string) {
    const savedViews = preferences.savedViews.filter((view) => view.id !== viewId);
    if (preferences.activeViewId === viewId) {
      updatePreferences({
        ...preferences,
        savedViews,
        activeViewId: null,
        visibleColumns: [...defaultVisibleColumns],
        columnFilters: {},
      });
    } else {
      updatePreferences({ ...preferences, savedViews });
    }
    setSelection(createEmptySelection());
    setClientPage(1);
  }

  function setClientPageSize(pageSize: TablePageSize) {
    if (pageSize === preferences.pageSize) return;
    updatePreferences({ ...preferences, pageSize });
    setClientPage(1);
    setSelection(createEmptySelection());
  }

  const updateMatchingPageRowIds = useCallback((rowIds: string[]) => {
    setMatchingPageRowIds((current) =>
      current.length === rowIds.length && current.every((id, index) => id === rowIds[index])
        ? current
        : rowIds
    );
  }, []);
  const updateMatchingRowCount = useCallback((rowCount: number) => {
    setMatchingRowCount((current) => current === rowCount ? current : rowCount);
  }, []);

  const selectedCount = selectedRowCount(selection, totalResults);
  const isSelected = useMemo(() => createSelectionLookup(selection), [selection]);
  const hasColumnFilters = Object.keys(preferences.columnFilters).length > 0;
  const selectablePageRowIds = hasColumnFilters ? matchingPageRowIds : pageRowIds;
  const selectedOnPage = selectablePageRowIds.filter(isSelected).length;
  const pageSelection = derivePageSelection(selectablePageRowIds.length, selectedOnPage);
  const visibleColumns = useMemo(
    () => new Set(preferences.visibleColumns),
    [preferences.visibleColumns]
  );
  const clearSelection = () => setSelection(createEmptySelection());
  const renderState: OperationalTableRenderState = {
    visibleColumns,
    selection,
    isSelected,
    toggleRow: (rowId) => setSelection((current) => toggleSelectedRow(current, rowId)),
    pageSelection,
    togglePage: (selected) =>
      setSelection((current) => selectPageRows(current, selectablePageRowIds, selected)),
    clearSelection,
  };

  return (
    <section ref={setWorkspaceRoot} className="operational-table-workspace">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/15 px-3 py-2">
        <TableViewManager
          columns={columns}
          views={preferences.savedViews}
          activeViewId={preferences.activeViewId}
          visibleColumns={preferences.visibleColumns}
          columnFilters={preferences.columnFilters}
          onSelect={selectTableView}
          onSave={saveTableView}
          onDelete={deleteTableView}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon /> Spalten
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.has(column.key)}
                  disabled={column.required}
                  onCheckedChange={(checked) => setColumn(column, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {totalResults} Treffer
          </span>
        </div>
      </div>

      {preferencesLoaded ? (
        <ColumnFilterLayer
          root={workspaceRoot}
          columns={columns}
          filters={preferences.columnFilters}
          onFilterChange={setColumnFilter}
          onClearFilters={clearColumnFilters}
          onMatchingRowIdsChange={updateMatchingPageRowIds}
          onMatchingRowCountChange={updateMatchingRowCount}
          paginateRows={clientPagination}
          page={clientPage}
          pageSize={preferences.pageSize}
        />
      ) : null}

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-accent/45 px-3 py-2 text-sm" role="status">
          <strong>{selectedCount} ausgewählt</strong>
          {!hasColumnFilters && selection.mode === "explicit" && selectedOnPage === pageRowIds.length && selectedCount < totalResults ? (
            <Button variant="link" size="sm" onClick={() => setSelection(selectAllResults())}>
              Alle {totalResults} Treffer auswählen
            </Button>
          ) : null}
          {renderBulkActions?.(selection, selectedCount, clearSelection)}
          <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
            Auswahl aufheben
          </Button>
        </div>
      ) : null}

      {renderTable(renderState)}
      {clientPagination && preferencesLoaded ? (
        <ClientOperationalPagination
          page={clientPage}
          pageSize={preferences.pageSize}
          totalResults={matchingRowCount}
          onPageChange={setClientPage}
          onPageSizeChange={setClientPageSize}
        />
      ) : null}
    </section>
  );
}

function derivePageSelection(
  selectableCount: number,
  selectedCount: number
): boolean | "indeterminate" {
  if (selectableCount > 0 && selectedCount === selectableCount) return true;
  if (selectedCount > 0) return "indeterminate";
  return false;
}

function sameStringValues(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
}

function sameColumnFilters(
  left: Readonly<TableColumnFilters>,
  right: Readonly<TableColumnFilters>
): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([columnKey, values]) => {
    const otherValues = right[columnKey];
    return otherValues !== undefined && sameStringValues(values, otherValues);
  });
}

function sameSavedView(left: SavedTableView, right: SavedTableView): boolean {
  return left.id === right.id &&
    left.name === right.name &&
    sameStringValues(left.visibleColumns, right.visibleColumns) &&
    sameColumnFilters(left.columnFilters, right.columnFilters);
}

function withUpdatedActiveView(
  preferences: TablePreferences,
  visibleColumns: string[],
  columnFilters: TableColumnFilters
): TablePreferences {
  const activeViewId = preferences.activeViewId;
  const savedViews = activeViewId
    ? preferences.savedViews.map((view) =>
        view.id === activeViewId
          ? {
              ...view,
              visibleColumns: [...visibleColumns],
              columnFilters: { ...columnFilters },
            }
          : view
      )
    : preferences.savedViews;
  return {
    ...preferences,
    visibleColumns,
    columnFilters,
    savedViews,
  };
}

export function TableSelectionCheckbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
    />
  );
}
