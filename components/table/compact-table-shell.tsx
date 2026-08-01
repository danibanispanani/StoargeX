"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OperationalModuleDefinition } from "@/lib/operational-modules";
import type { TablePreferenceScope } from "@/lib/operational-table";
import { OperationalTableWorkspace } from "@/components/table/operational-table-workspace";

/**
 * Compatibility adapter for module-owned static tables.
 *
 * It delegates preference persistence and column visibility to
 * OperationalTableWorkspace. Selection stays disabled until a module
 * has a real result-set mutation contract.
 */
export function CompactTableShell({
  definition,
  scope,
  currentQuery,
  totalResults,
  children,
  className,
  clientPagination = true,
}: {
  definition: OperationalModuleDefinition;
  scope: Omit<TablePreferenceScope, "tableKey">;
  currentQuery: string;
  totalResults: number;
  children: React.ReactNode;
  className?: string;
  clientPagination?: boolean;
}) {
  const tableScope = useMemo(
    () => ({ ...scope, tableKey: definition.key }),
    [definition.key, scope]
  );

  return (
    <div className={cn("compact-table-shell overflow-hidden border bg-card shadow-xs", className)}>
      <OperationalTableWorkspace
        scope={tableScope}
        columns={definition.columns}
        defaultVisibleColumns={definition.defaultVisibleColumns}
        pageRowIds={[]}
        totalResults={totalResults}
        currentQuery={currentQuery}
        clientPagination={clientPagination}
        renderTable={({ visibleColumns }) => {
          return (
            <CompactTableView
              columns={definition.columns}
              visibleColumns={visibleColumns}
            >
              {children}
            </CompactTableView>
          );
        }}
      />
    </div>
  );
}

function CompactTableView({
  columns,
  visibleColumns,
  children,
}: {
  columns: OperationalModuleDefinition["columns"];
  visibleColumns: ReadonlySet<string>;
  children: ReactNode;
}) {
  const columnCss = useMemo(
    () => columns
      .filter((column) => !visibleColumns.has(column.key))
      .map(
        (column) =>
          `[data-table-view-root] [data-column-key="${column.key}"]{display:none}`
      )
      .join("\n"),
    [columns, visibleColumns]
  );

  return (
    <div data-table-view-root className="min-w-0">
      <style>{columnCss}</style>
      {children}
    </div>
  );
}
