"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  updateOperationalViewQuery,
  type OperationalModuleDefinition,
} from "@/lib/operational-modules";
import type { TablePreferenceScope } from "@/lib/operational-table";
import { OperationalTableWorkspace } from "@/components/table/operational-table-workspace";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Compatibility adapter for module-owned static tables.
 *
 * It delegates preference persistence, column visibility, density and saved
 * views to OperationalTableWorkspace. Selection stays disabled until a module
 * has a real result-set mutation contract.
 */
export function CompactTableShell({
  definition,
  scope,
  requestedView,
  viewParam = "preset",
  currentQuery,
  totalResults,
  children,
  className,
}: {
  definition: OperationalModuleDefinition;
  scope: Omit<TablePreferenceScope, "tableKey">;
  requestedView?: string;
  viewParam?: string;
  currentQuery: string;
  totalResults: number;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const views = definition.views;
  const defaultView = views[0]?.value ?? "standard";
  const [view, setView] = useState(
    requestedView && views.some((option) => option.value === requestedView)
      ? requestedView
      : defaultView
  );
  const tableScope = useMemo(
    () => ({ ...scope, tableKey: definition.key }),
    [definition.key, scope]
  );
  const storageName = `storagex:${scope.organizationId}:${scope.userId}:${definition.key}:module-view`;
  const viewCss = useMemo(
    () =>
      views
        .map(
          (option) =>
            `[data-table-view-root][data-view="${option.value}"] [data-column]:not([data-view-${option.value}]),` +
            `[data-table-view-root][data-view="${option.value}"] [data-table-view-row]:not([data-row-view-${option.value}]){display:none}`
        )
        .join("\n"),
    [views]
  );

  useEffect(() => {
    if (requestedView && views.some((option) => option.value === requestedView)) {
      setView(requestedView);
      return;
    }
    const saved = window.localStorage.getItem(storageName);
    if (saved && views.some((option) => option.value === saved)) {
      setView(saved);
    }
  }, [requestedView, storageName, views]);

  function changeView(nextView: string) {
    setView(nextView);
    window.localStorage.setItem(storageName, nextView);
    const query = updateOperationalViewQuery(
      currentQuery,
      viewParam,
      nextView,
      defaultView
    );
    router.replace(`${definition.route}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className={cn("compact-table-shell border", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Modulansicht und Tabelleneinstellungen werden benutzerbezogen gespeichert.
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${definition.key}-view`} className="text-xs">
            Ansicht
          </Label>
          <Select value={view} onValueChange={changeView}>
            <SelectTrigger id={`${definition.key}-view`} className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {views.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <OperationalTableWorkspace
        scope={tableScope}
        columns={definition.columns}
        defaultVisibleColumns={definition.defaultVisibleColumns}
        pageRowIds={[]}
        totalResults={totalResults}
        currentQuery={currentQuery}
        basePath={definition.route}
        renderTable={({ density, visibleColumns }) => {
          const columnCss = definition.columns
            .filter((column) => !visibleColumns.has(column.key))
            .map(
              (column) =>
                `[data-table-view-root] [data-column-key="${column.key}"]{display:none}`
            )
            .join("\n");

          return (
            <div
              data-table-view-root
              data-view={view}
              data-density={density}
              className="min-w-0"
            >
              <style>{`${viewCss}\n${columnCss}`}</style>
              {children}
            </div>
          );
        }}
      />
    </div>
  );
}
