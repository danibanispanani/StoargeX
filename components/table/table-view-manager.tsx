"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  LayoutListIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { OperationalColumnOption } from "@/components/table/operational-table-workspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_SAVED_TABLE_VIEWS,
  filterColumnFiltersByVisibleColumns,
  type SavedTableView,
  type TableColumnFilters,
} from "@/lib/operational-table";

export function TableViewManager({
  columns,
  views,
  activeViewId,
  visibleColumns,
  columnFilters,
  onSelect,
  onSave,
  onDelete,
}: {
  columns: readonly OperationalColumnOption[];
  views: readonly SavedTableView[];
  activeViewId: string | null;
  visibleColumns: readonly string[];
  columnFilters: TableColumnFilters;
  onSelect: (viewId: string | null) => void;
  onSave: (view: SavedTableView) => void;
  onDelete: (viewId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [draftColumns, setDraftColumns] = useState<string[]>([]);
  const activeView = views.find((view) => view.id === activeViewId) ?? null;
  const editingView = views.find((view) => view.id === editingViewId) ?? null;
  const selectedColumns = useMemo(() => new Set(draftColumns), [draftColumns]);

  function openCreateDialog() {
    setEditingViewId(null);
    setName("");
    setDraftColumns([...visibleColumns]);
    setDialogOpen(true);
  }

  function openEditDialog(view: SavedTableView) {
    setEditingViewId(view.id);
    setName(view.name);
    setDraftColumns([...view.visibleColumns]);
    setDialogOpen(true);
  }

  function toggleColumn(column: OperationalColumnOption, checked: boolean) {
    if (column.required && !checked) return;
    setDraftColumns((current) => {
      const next = new Set(current);
      if (checked) next.add(column.key);
      else next.delete(column.key);
      return columns.filter((option) => next.has(option.key)).map((option) => option.key);
    });
  }

  function saveView() {
    const trimmedName = name.trim();
    if (!trimmedName || draftColumns.length === 0) return;
    const sourceFilters = editingViewId === activeViewId
      ? columnFilters
      : editingView?.columnFilters ?? columnFilters;
    onSave({
      id: editingViewId ?? crypto.randomUUID(),
      name: trimmedName,
      visibleColumns: [...draftColumns],
      columnFilters: filterColumnFiltersByVisibleColumns(sourceFilters, draftColumns),
    });
    setDialogOpen(false);
  }

  function deleteView() {
    if (!editingViewId) return;
    onDelete(editingViewId);
    setDialogOpen(false);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-44 justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <LayoutListIcon aria-hidden="true" />
              <span className="truncate">{activeView?.name ?? "Standard"}</span>
            </span>
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onSelect={() => onSelect(null)}>
            <CheckIcon className={activeViewId === null ? "opacity-100" : "opacity-0"} />
            Standard
          </DropdownMenuItem>
          <DropdownMenuGroup className="grid grid-cols-[minmax(0,1fr)_auto]">
            {views.map((view) => (
              <Fragment key={view.id}>
              <DropdownMenuItem
                onSelect={() => onSelect(view.id)}
                className="min-w-0"
              >
                <CheckIcon className={activeViewId === view.id ? "opacity-100" : "opacity-0"} />
                <span className="truncate">{view.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                aria-label={`Ansicht ${view.name} bearbeiten`}
                className="justify-center px-2"
                onSelect={() => {
                  setMenuOpen(false);
                  openEditDialog(view);
                }}
              >
                <PencilIcon aria-hidden="true" />
              </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={views.length >= MAX_SAVED_TABLE_VIEWS}
            onSelect={(event) => {
              event.preventDefault();
              setMenuOpen(false);
              openCreateDialog();
            }}
          >
            <PlusIcon />
            Ansicht erstellen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingView ? "Ansicht bearbeiten" : "Ansicht erstellen"}
            </DialogTitle>
            <DialogDescription>
              Lege fest, welche Spalten diese Ansicht zeigt. Aktive Spaltenfilter
              werden zusammen mit der Ansicht gespeichert.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="table-view-name">Name der Ansicht</Label>
            <Input
              id="table-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="Zum Beispiel: Offene Vorgänge"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Sichtbare Spalten</p>
            <div className="grid max-h-72 gap-1 overflow-y-auto border p-2 sm:grid-cols-2">
              {columns.map((column) => {
                const checked = selectedColumns.has(column.key);
                return (
                  <Label
                    key={column.key}
                    className="rounded-md px-2 py-2 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={column.required}
                      onCheckedChange={(value) => toggleColumn(column, value === true)}
                    />
                    <span>{column.label}</span>
                    {column.required ? (
                      <span className="ml-auto text-xs text-muted-foreground">Pflicht</span>
                    ) : null}
                  </Label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <div>
              {editingView ? (
                <Button type="button" variant="destructive" onClick={deleteView}>
                  <Trash2Icon /> Ansicht löschen
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline">Abbrechen</Button>
              </DialogClose>
              <Button
                type="button"
                onClick={saveView}
                disabled={!name.trim() || draftColumns.length === 0}
              >
                Ansicht speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
