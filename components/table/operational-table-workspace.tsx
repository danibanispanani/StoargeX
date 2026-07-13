"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookmarkIcon, Columns3Icon, Rows3Icon, Trash2Icon } from "lucide-react";
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
  type TableDensity,
  type TablePreferenceScope,
  type TablePreferences,
  type TableSelection,
} from "@/lib/operational-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
}

export interface OperationalTableRenderState {
  density: TableDensity;
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
  basePath,
  renderTable,
  renderBulkActions,
}: {
  scope: TablePreferenceScope;
  columns: readonly OperationalColumnOption[];
  defaultVisibleColumns: readonly string[];
  pageRowIds: readonly string[];
  totalResults: number;
  currentQuery: string;
  basePath: string;
  renderTable: (state: OperationalTableRenderState) => ReactNode;
  renderBulkActions?: (
    selection: TableSelection,
    selectedCount: number,
    clearSelection: () => void
  ) => ReactNode;
}) {
  const router = useRouter();
  const storageKey = tablePreferenceStorageKey(scope);
  const allowedColumns = useMemo(() => columns.map((column) => column.key), [columns]);
  const [preferences, setPreferences] = useState<TablePreferences>({
    density: "comfortable",
    visibleColumns: [...defaultVisibleColumns],
    savedViews: [],
  });
  const [selection, setSelection] = useState<TableSelection>(createEmptySelection());
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");

  useEffect(() => {
    setPreferences(
      loadTablePreferences(window.localStorage, storageKey, {
        allowedColumns,
        defaultVisibleColumns,
      })
    );
  }, [allowedColumns, defaultVisibleColumns, storageKey]);

  useEffect(() => {
    setSelection(createEmptySelection());
  }, [currentQuery, storageKey]);

  function updatePreferences(next: TablePreferences) {
    setPreferences(next);
    saveTablePreferences(window.localStorage, storageKey, next);
  }

  function setDensity(density: TableDensity) {
    updatePreferences({ ...preferences, density });
  }

  function setColumn(column: OperationalColumnOption, visible: boolean) {
    if (column.required && !visible) return;
    const next = new Set(preferences.visibleColumns);
    if (visible) next.add(column.key);
    else next.delete(column.key);
    updatePreferences({ ...preferences, visibleColumns: [...next] });
  }

  function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    const params = new URLSearchParams(currentQuery);
    params.delete("page");
    const saved = {
      id: crypto.randomUUID(),
      name,
      query: params.toString(),
      density: preferences.density,
      visibleColumns: preferences.visibleColumns,
    };
    updatePreferences({
      ...preferences,
      savedViews: [...preferences.savedViews, saved].slice(-MAX_SAVED_TABLE_VIEWS),
    });
    setSelectedViewId(saved.id);
    setViewName("");
    setSaveOpen(false);
  }

  function applySavedView(id: string) {
    setSelectedViewId(id);
    const view = preferences.savedViews.find((item) => item.id === id);
    if (!view) return;
    const next = {
      ...preferences,
      density: view.density ?? preferences.density,
      visibleColumns: view.visibleColumns?.length
        ? view.visibleColumns.filter((column) => allowedColumns.includes(column))
        : preferences.visibleColumns,
    };
    updatePreferences(next);
    router.push(`${basePath}${view.query ? `?${view.query}` : ""}`);
  }

  function deleteSelectedView() {
    if (!selectedViewId) return;
    updatePreferences({
      ...preferences,
      savedViews: preferences.savedViews.filter((view) => view.id !== selectedViewId),
    });
    setSelectedViewId("");
  }

  const selectedCount = selectedRowCount(selection, totalResults);
  const isSelected = useMemo(() => createSelectionLookup(selection), [selection]);
  const selectedOnPage = pageRowIds.filter(isSelected).length;
  const pageSelection =
    pageRowIds.length > 0 && selectedOnPage === pageRowIds.length
      ? true
      : selectedOnPage > 0
        ? "indeterminate"
        : false;
  const visibleColumns = new Set(preferences.visibleColumns);
  const clearSelection = () => setSelection(createEmptySelection());
  const renderState: OperationalTableRenderState = {
    density: preferences.density,
    visibleColumns,
    selection,
    isSelected,
    toggleRow: (rowId) => setSelection((current) => toggleSelectedRow(current, rowId)),
    pageSelection,
    togglePage: (selected) =>
      setSelection((current) => selectPageRows(current, pageRowIds, selected)),
    clearSelection,
  };

  return (
    <section className="operational-table-workspace" data-density={preferences.density}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Rows3Icon className="size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Dichte</span>
            <select
              value={preferences.density}
              onChange={(event) => setDensity(event.target.value as TableDensity)}
              className="border-input h-8 rounded-md border bg-background px-2 text-xs text-foreground"
            >
              <option value="comfortable">Komfortabel</option>
              <option value="compact">Kompakt</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookmarkIcon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Gespeicherte Ansicht</span>
            <select
              value={selectedViewId}
              onChange={(event) => applySavedView(event.target.value)}
              className="border-input h-8 max-w-48 rounded-md border bg-background px-2 text-xs text-foreground"
            >
              <option value="">Gespeicherte Ansichten</option>
              {preferences.savedViews.map((view) => (
                <option key={view.id} value={view.id}>{view.name}</option>
              ))}
            </select>
          </label>

          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">Ansicht speichern</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Aktuelle Ansicht speichern</DialogTitle>
                <DialogDescription>
                  Filter, Sortierung, Spalten und Dichte werden für diese Organisation gespeichert.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveCurrentView();
                }}
                className="space-y-3"
              >
                <Input
                  value={viewName}
                  onChange={(event) => setViewName(event.target.value)}
                  placeholder="z. B. Elektronik ohne EAN"
                  maxLength={80}
                  autoFocus
                />
                <Button type="submit" disabled={!viewName.trim()} className="w-full">
                  Speichern
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {selectedViewId ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={deleteSelectedView}
              aria-label="Gespeicherte Ansicht löschen"
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {totalResults} Treffer
        </span>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-accent/45 px-3 py-2 text-sm" role="status">
          <strong>{selectedCount} ausgewählt</strong>
          {selection.mode === "explicit" && selectedOnPage === pageRowIds.length && selectedCount < totalResults ? (
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
    </section>
  );
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
