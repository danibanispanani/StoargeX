"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FilterIcon, XIcon } from "lucide-react";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  normalizeTableFilterValue,
  normalizeTableFilterValues,
  type TableColumnFilters,
  type TablePageSize,
} from "@/lib/operational-table";
import type { OperationalColumnOption } from "@/components/table/operational-table-workspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HeaderAnchor {
  id: string;
  column: OperationalColumnOption;
  element: HTMLSpanElement;
}

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

export function ColumnFilterLayer({
  root,
  columns,
  filters,
  onFilterChange,
  onClearFilters,
  onMatchingRowIdsChange,
  onMatchingRowCountChange,
  paginateRows = false,
  page = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
}: {
  root: HTMLElement | null;
  columns: readonly OperationalColumnOption[];
  filters: TableColumnFilters;
  onFilterChange: (columnKey: string, selectedValues: string[] | null) => void;
  onClearFilters: () => void;
  onMatchingRowIdsChange?: (rowIds: string[]) => void;
  onMatchingRowCountChange?: (rowCount: number) => void;
  paginateRows?: boolean;
  page?: number;
  pageSize?: TablePageSize;
}) {
  const [anchors, setAnchors] = useState<HeaderAnchor[]>([]);
  const [domRevision, setDomRevision] = useState(0);
  const [matchingRowsInView, setMatchingRowsInView] = useState<HTMLTableRowElement[]>([]);
  const filterableColumns = useMemo(
    () => columns.filter(isFilterableColumn),
    [columns]
  );
  const activeEntries = useMemo(() => Object.entries(filters), [filters]);

  useEffect(() => {
    if (!root) return;
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        setDomRevision((current) => current + 1);
      });
    };
    const observer = new MutationObserver((mutations) => {
      const affectsTableData = mutations.some((mutation) => {
        const target = mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
        return mutation.type === "attributes" && target?.matches("[data-table-view-root]") || Boolean(
          target?.closest("thead, tbody") &&
          !target.closest(".sx-column-filter-anchor")
        );
      });
      if (affectsTableData) refresh();
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-view"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    const handleChange = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("tbody")) refresh();
    };
    root.addEventListener("change", handleChange);
    return () => {
      observer.disconnect();
      root.removeEventListener("change", handleChange);
    };
  }, [root]);

  useLayoutEffect(() => {
    if (!root) return;
    const nextAnchors: HeaderAnchor[] = [];
    const headers = Array.from(
      root.querySelectorAll<HTMLTableCellElement>("thead th")
    );
    for (const column of filterableColumns) {
      findHeaders(headers, column).forEach((header, index) => {
        const anchorId = `${column.key}:${index}`;
        let anchor = header.querySelector<HTMLSpanElement>(
          `[data-column-filter-anchor="${column.key}"]`
        );
        if (!anchor) {
          anchor = document.createElement("span");
          anchor.dataset.columnFilterAnchor = column.key;
          anchor.className = "sx-column-filter-anchor";
          header.append(anchor);
        }
        nextAnchors.push({ id: anchorId, column, element: anchor });
      });
    }
    setAnchors((current) => anchorsEqual(current, nextAnchors) ? current : nextAnchors);
  }, [domRevision, filterableColumns, root]);

  useEffect(() => {
    if (!root) return;
    const rows = dataRows(root);
    const compiledFilters = activeEntries.map(([columnKey, selectedValues]) => [
        columnKey,
        new Set(normalizeTableFilterValues(selectedValues)),
      ] as const);
    const columnIndexes = resolveColumnIndexes(root, activeEntries.map(([columnKey]) => columnKey));
    rows.forEach((row) => { row.hidden = false; });
    const activeViewRows = new Set(
      rows.filter((row) => getComputedStyle(row).display !== "none")
    );
    const nextMatchingRows: HTMLTableRowElement[] = [];
    for (const row of rows) {
      const matches = compiledFilters.every(([columnKey, selectedValues]) => {
        if (selectedValues.size === 0) return false;
        return readColumnValues(row, columnKey, columnIndexes.get(columnKey))
          .some((value) => selectedValues.has(value));
      });
      row.hidden = !matches;
      if (matches && activeViewRows.has(row)) nextMatchingRows.push(row);
    }
    setMatchingRowsInView(nextMatchingRows);
    onMatchingRowCountChange?.(nextMatchingRows.length);
    return () => rows.forEach((row) => { row.hidden = false; });
  }, [activeEntries, domRevision, onMatchingRowCountChange, root]);

  useEffect(() => {
    const firstVisibleIndex = paginateRows ? (page - 1) * pageSize : 0;
    const lastVisibleIndex = paginateRows
      ? firstVisibleIndex + pageSize
      : matchingRowsInView.length;
    const matchingRowIds: string[] = [];
    matchingRowsInView.forEach((row, index) => {
      const onCurrentPage = index >= firstVisibleIndex && index < lastVisibleIndex;
      row.hidden = !onCurrentPage;
      if (onCurrentPage && row.dataset.rowId) matchingRowIds.push(row.dataset.rowId);
    });
    onMatchingRowIdsChange?.(matchingRowIds);
  }, [matchingRowsInView, onMatchingRowIdsChange, page, pageSize, paginateRows]);

  return (
    <>
      {anchors.map((anchor) => createPortal(
        <ColumnFilterMenu
          root={root}
          column={anchor.column}
          selectedValues={filters[anchor.column.key]}
          onApply={(selectedValues) => onFilterChange(anchor.column.key, selectedValues)}
        />,
        anchor.element,
        anchor.id
      ))}

      {activeEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium">Aktive Spaltenfilter:</span>
          {activeEntries.map(([columnKey, selectedValues]) => {
            const column = columns.find((item) => item.key === columnKey);
            return (
              <button
                key={columnKey}
                type="button"
                className="inline-flex h-7 items-center gap-1 border bg-background px-2 hover:bg-muted"
                onClick={() => onFilterChange(columnKey, null)}
                title="Diesen Filter entfernen"
              >
                {column?.label ?? columnKey}: {selectedValues.length || "keine"}
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            );
          })}
          <span className="ml-auto text-muted-foreground">{matchingRowsInView.length} passende Zeilen in der geladenen Ansicht</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>Alle Filter löschen</Button>
        </div>
      ) : null}
    </>
  );
}

function ColumnFilterMenu({
  root,
  column,
  selectedValues,
  onApply,
}: {
  root: HTMLElement | null;
  column: OperationalColumnOption;
  selectedValues: string[] | undefined;
  onApply: (selectedValues: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const active = selectedValues !== undefined;
  const draftSet = useMemo(() => new Set(draft), [draft]);
  const visibleOptions = options.filter((option) =>
    option.toLocaleLowerCase("de-DE").includes(search.trim().toLocaleLowerCase("de-DE"))
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || !root) return;
    const nextOptions = collectColumnOptions(root, column);
    const selected = selectedValues ?? nextOptions;
    setOptions(normalizeTableFilterValues([...nextOptions, ...selected]).sort(collator.compare));
    setDraft(selected);
    setSearch("");
  }

  function toggle(value: string, checked: boolean) {
    setDraft((current) => checked
      ? normalizeTableFilterValues([...current, value])
      : current.filter((item) => item !== value));
  }

  function apply() {
    const allSelected = options.length === 0 || options.every((option) => draftSet.has(option));
    onApply(allSelected ? null : draft);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "ml-1 inline-grid size-6 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-primary/10 text-primary"
          )}
          aria-label={`${column.label} filtern`}
          title={`${column.label} filtern`}
        >
          <FilterIcon className={cn("size-3.5", active && "fill-current")} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0" onCloseAutoFocus={(event) => event.preventDefault()}>
        <div className="border-b p-3">
          <p className="mb-2 text-sm font-medium">{column.label} filtern</p>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Wert suchen…" className="h-8" />
          <div className="mt-2 flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(options)}>Alle auswählen</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft([])}>Alle abwählen</Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visibleOptions.length > 0 ? visibleOptions.map((option) => (
            <label key={option} className="flex min-h-8 cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-muted">
              <Checkbox checked={draftSet.has(option)} onCheckedChange={(checked) => toggle(option, checked === true)} />
              <span className="min-w-0 flex-1 truncate" title={option}>{option}</span>
            </label>
          )) : <p className="px-2 py-4 text-center text-sm text-muted-foreground">Keine Werte gefunden.</p>}
        </div>
        <div className="flex justify-between border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { onApply(null); setOpen(false); }}>Filter löschen</Button>
          <Button type="button" size="sm" onClick={apply}>Anwenden</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isFilterableColumn(column: OperationalColumnOption): boolean {
  return column.filterable !== false;
}

function findHeaders(
  headers: readonly HTMLTableCellElement[],
  column: OperationalColumnOption
): HTMLTableCellElement[] {
  return headers.filter((header) => header.dataset.columnKey === column.key);
}

function dataRows(root: HTMLElement): HTMLTableRowElement[] {
  return Array.from(root.querySelectorAll<HTMLTableRowElement>("table[data-slot='table'] > tbody > tr"))
    .filter((row) => row.cells.length > 0 && !row.querySelector("td[colspan]"));
}

function collectColumnOptions(root: HTMLElement, column: OperationalColumnOption): string[] {
  const columnIndex = resolveColumnIndexes(root, [column.key]).get(column.key);
  const values = dataRows(root).flatMap((row) => readColumnValues(row, column.key, columnIndex));
  return normalizeTableFilterValues(values).sort(collator.compare);
}

function readColumnValues(
  row: HTMLTableRowElement,
  columnKey: string,
  columnIndex: number | undefined
): string[] {
  const cell = findColumnCell(row, columnKey, columnIndex);
  if (!cell) return [];
  const explicitValues = cell.dataset.filterValues;
  if (explicitValues) {
    try {
      const parsed = JSON.parse(explicitValues);
      if (Array.isArray(parsed)) return uniqueNormalizedValues(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
      return uniqueNormalizedValues(explicitValues.split("|"));
    }
  }
  if (cell.dataset.filterValue !== undefined) {
    return [normalizeTableFilterValue(cell.dataset.filterValue)];
  }
  const descendantValues = Array.from(cell.querySelectorAll<HTMLElement>("[data-filter-value]"))
    .map((element) => element.dataset.filterValue ?? "");
  if (descendantValues.length > 0) return uniqueNormalizedValues(descendantValues);
  const selects = Array.from(cell.querySelectorAll<HTMLSelectElement>("select"));
  if (selects.length > 0) {
    return uniqueNormalizedValues(selects.flatMap((select) =>
      Array.from(select.selectedOptions).map((option) => option.textContent ?? option.value)
    ));
  }
  const textValue = normalizeTableFilterValue(cell.innerText);
  if (cell.querySelector("img") && textValue === "Leer") return ["Mit Bild"];
  return [textValue];
}

function findColumnCell(
  row: HTMLTableRowElement,
  columnKey: string,
  columnIndex: number | undefined
): HTMLTableCellElement | null {
  const direct = row.querySelector<HTMLTableCellElement>(`td[data-column-key="${columnKey}"]`);
  if (direct) return direct;
  return columnIndex === undefined ? null : row.cells.item(columnIndex);
}

function resolveColumnIndexes(
  root: HTMLElement,
  columnKeys: readonly string[]
): Map<string, number> {
  const indexes = new Map<string, number>();
  const requested = new Set(columnKeys);
  root.querySelectorAll<HTMLTableCellElement>("thead th[data-column-key]").forEach((header) => {
    const key = header.dataset.columnKey;
    if (key && requested.has(key) && !indexes.has(key)) indexes.set(key, header.cellIndex);
  });
  return indexes;
}

function anchorsEqual(current: readonly HeaderAnchor[], next: readonly HeaderAnchor[]): boolean {
  return current.length === next.length && current.every((anchor, index) => {
    const candidate = next[index];
    return candidate?.id === anchor.id &&
      candidate.column.key === anchor.column.key &&
      candidate.element === anchor.element;
  });
}

function uniqueNormalizedValues(values: readonly string[]): string[] {
  return normalizeTableFilterValues(values);
}
