"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { EntryStatus, StockItemStatus } from "@prisma/client";
import {
  bulkUpdateStockAction,
  toggleListingAction,
  updateEntryStatusAction,
  updateStockItemStatusAction,
} from "@/lib/actions/stock";
import {
  ENTRY_STATUS,
  ENTRY_STATUS_TITLES,
  KAUF_STATUS_OPTIONS,
  RETOURE_STATUS_OPTIONS,
  STOCK_STATUS,
  STOCK_STATUS_OPTIONS,
} from "@/lib/constants";
import { formatEuro } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StockItemDialog,
  type EditableStockItem,
} from "@/components/stock/stock-item-dialog";
import { DeleteStockItemButton } from "@/components/stock/delete-stock-item-button";
import type { PickerProduct } from "@/components/products/product-picker";

export interface StockRow {
  id: string;
  sku: string;
  date: string; // dd.mm.yyyy
  dateIso: string; // yyyy-mm-dd (fürs Edit-Formular)
  supplier: string;
  title: string;
  variant: string;
  size: string;
  grossCents: number;
  netCents: number | null;
  inputTaxDeductible: boolean;
  zm: string;
  kaufStatus: EntryStatus;
  retoureStatus: EntryStatus;
  status: StockItemStatus;
  ean: string;
  imageUrl: string | null;
  listings: string[]; // platformIds
  notes: string;
  low: boolean; // niedriger Bestand (Zeilen-Markierung)
}

export function StockTable({
  rows,
  platforms,
  zmOptions,
  products,
}: {
  rows: StockRow[];
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  products: PickerProduct[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<{ error?: string; success?: string } | null>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  function bulk(patch: Parameters<typeof bulkUpdateStockAction>[1]) {
    run(() => bulkUpdateStockAction([...selected], patch));
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          platforms={platforms}
          disabled={pending}
          onApply={bulk}
          onClear={() => setSelected(new Set())}
        />
      )}

      <Card>
        <CardContent className="sx-table-shell p-0">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead className="sx-sticky-0 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Alle auswählen"
                    className="size-4"
                  />
                </TableHead>
                <TableHead className="sx-sticky-1">LagerID</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Händler</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Colorway/Version</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="text-center">VST</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead>ZM</TableHead>
                <TableHead>Kauf</TableHead>
                <TableHead>Retoure</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead>Bilder</TableHead>
                {platforms.map((p) => (
                  <TableHead key={p.id} className="text-center">
                    {p.name}
                  </TableHead>
                ))}
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={17 + platforms.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Keine Artikel gefunden. Über „Wareneingang erfassen&ldquo;
                    trägst du den ersten Artikel ein – Katalogprodukte lassen
                    sich dabei per Suche übernehmen.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-selected={selected.has(row.id)}
                  data-low={row.low}
                >
                  <TableCell className="sx-sticky-0">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`${row.sku} auswählen`}
                      className="size-4"
                    />
                  </TableCell>
                  <TableCell className="sx-sticky-1 font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                  <TableCell>{row.supplier || "–"}</TableCell>
                  <TableCell className="max-w-44 truncate font-medium">{row.title}</TableCell>
                  <TableCell className="max-w-36 truncate">{row.variant || "–"}</TableCell>
                  <TableCell>{row.size || "–"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.grossCents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.inputTaxDeductible ? "✓" : "–"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.netCents !== null ? formatEuro(row.netCents) : "–"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.zm || "–"}</TableCell>
                  <TableCell>
                    <ColoredSelect
                      value={row.kaufStatus}
                      options={KAUF_STATUS_OPTIONS}
                      styles={ENTRY_STATUS}
                      titles={ENTRY_STATUS_TITLES}
                      disabled={pending}
                      onChange={(value) =>
                        run(() =>
                          updateEntryStatusAction(row.id, "kaufStatus", value as EntryStatus)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <ColoredSelect
                      value={row.retoureStatus}
                      options={RETOURE_STATUS_OPTIONS}
                      styles={ENTRY_STATUS}
                      titles={ENTRY_STATUS_TITLES}
                      disabled={pending}
                      onChange={(value) =>
                        run(() =>
                          updateEntryStatusAction(row.id, "retoureStatus", value as EntryStatus)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={row.status}
                      disabled={pending}
                      onChange={(e) =>
                        run(() =>
                          updateStockItemStatusAction(
                            row.id,
                            e.target.value as StockItemStatus
                          )
                        )
                      }
                      className={cn(
                        "h-7 rounded-md border-0 px-2 text-xs font-medium",
                        STOCK_STATUS[row.status].className
                      )}
                    >
                      {STOCK_STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {STOCK_STATUS[value].label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.ean || "–"}</TableCell>
                  <TableCell>
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.imageUrl}
                        alt={row.title}
                        className="size-8 rounded object-cover"
                      />
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  {platforms.map((platform) => (
                    <TableCell key={platform.id} className="text-center">
                      <input
                        type="checkbox"
                        checked={row.listings.includes(platform.id)}
                        disabled={pending}
                        title={`${platform.name}: gelistet?`}
                        onChange={(e) =>
                          run(() =>
                            toggleListingAction(row.id, platform.id, e.target.checked)
                          )
                        }
                        className="size-4"
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StockItemDialog
                        item={toEditable(row)}
                        platforms={platforms}
                        zmOptions={zmOptions}
                        products={products}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Bearbeiten
                          </Button>
                        }
                      />
                      <DeleteStockItemButton stockItemId={row.id} sku={row.sku} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function toEditable(row: StockRow): EditableStockItem {
  return {
    id: row.id,
    sku: row.sku,
    purchaseDate: row.dateIso,
    supplier: row.supplier,
    title: row.title,
    variant: row.variant,
    size: row.size,
    priceGross: (row.grossCents / 100).toFixed(2).replace(".", ","),
    inputTaxDeductible: row.inputTaxDeductible,
    paymentMethod: row.zm,
    kaufStatus: row.kaufStatus,
    retoureStatus: row.retoureStatus,
    status: row.status,
    ean: row.ean,
    notes: row.notes,
    platformIds: row.listings,
  };
}

function ColoredSelect({
  value,
  options,
  styles,
  titles,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  styles: Record<string, { label: string; className: string }>;
  titles: Record<string, string>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={titles[value]}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 rounded-md border-0 px-1.5 text-xs font-medium",
        styles[value].className
      )}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {styles[option].label}
        </option>
      ))}
    </select>
  );
}

function BulkBar({
  count,
  platforms,
  disabled,
  onApply,
  onClear,
}: {
  count: number;
  platforms: Array<{ id: string; name: string }>;
  disabled: boolean;
  onApply: (patch: {
    status?: StockItemStatus;
    kaufStatus?: EntryStatus;
    retoureStatus?: EntryStatus;
    platformId?: string;
    platformListed?: boolean;
  }) => void;
  onClear: () => void;
}) {
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/50 p-2 text-sm">
      <span className="font-medium">{count} markiert</span>
      <select
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onApply({ status: e.target.value as StockItemStatus });
          e.target.value = "";
        }}
        className="border-input h-8 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          Status setzen…
        </option>
        {STOCK_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {STOCK_STATUS[value].label}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onApply({ kaufStatus: e.target.value as EntryStatus });
          e.target.value = "";
        }}
        className="border-input h-8 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          Kauf setzen…
        </option>
        {KAUF_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value} – {ENTRY_STATUS_TITLES[value]}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onApply({ retoureStatus: e.target.value as EntryStatus });
          e.target.value = "";
        }}
        className="border-input h-8 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          Retoure setzen…
        </option>
        {RETOURE_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value} – {ENTRY_STATUS_TITLES[value]}
          </option>
        ))}
      </select>
      <span className="flex items-center gap-1">
        <select
          value={platformId}
          disabled={disabled}
          onChange={(e) => setPlatformId(e.target.value)}
          className="border-input h-8 rounded-md border bg-background px-2 text-xs"
        >
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !platformId}
          onClick={() => onApply({ platformId, platformListed: true })}
        >
          Listen
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !platformId}
          onClick={() => onApply({ platformId, platformListed: false })}
        >
          Entfernen
        </Button>
      </span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Auswahl aufheben
      </Button>
    </div>
  );
}
