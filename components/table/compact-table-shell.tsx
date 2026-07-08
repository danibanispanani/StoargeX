"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TableView = {
  value: string;
  label: string;
};

export function CompactTableShell({
  storageKey,
  views,
  defaultView = views[0]?.value ?? "standard",
  children,
  className,
}: {
  storageKey: string;
  views: TableView[];
  defaultView?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState(defaultView);
  const storageName = `storagex:${storageKey}:table-view`;
  const css = useMemo(
    () =>
      views
        .map(
          (option) =>
            `[data-table-view-root][data-view="${option.value}"] [data-column]:not([data-view-${option.value}]){display:none}`
        )
        .join("\n"),
    [views]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(storageName);
    if (saved && views.some((option) => option.value === saved)) {
      setView(saved);
    }
  }, [storageName, views]);

  function changeView(nextView: string) {
    setView(nextView);
    window.localStorage.setItem(storageName, nextView);
  }

  return (
    <div
      data-table-view-root
      data-view={view}
      className={cn("compact-table-shell space-y-3", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Ansicht wird auf diesem Gerät gespeichert.
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${storageKey}-view`} className="text-xs">
            Ansicht
          </Label>
          <Select value={view} onValueChange={changeView}>
            <SelectTrigger id={`${storageKey}-view`} className="h-8 w-40">
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
      <style>{css}</style>
      {children}
    </div>
  );
}
