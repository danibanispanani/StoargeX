"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { EntryStatus, StockItemStatus } from "@prisma/client";
import {
  bulkUpdateStockAction,
  adjustOwnedInventoryQuantityAction,
  toggleListingAction,
  toggleInventoryPositionListingAction,
  updateOwnedLotEntryStatusAction,
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
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  DetailDrawer,
  DetailGrid,
  DetailSection,
} from "@/components/table/detail-drawer";
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
import type { PickerProduct } from "@/components/products/product-picker";
import type { ActionState } from "@/lib/actions/team";
import { OPERATIONAL_MODULES } from "@/lib/operational-modules";
import type { TablePreferenceScope } from "@/lib/operational-table";

export interface StockRow {
  source: "owned" | "legacy";
  id: string;
  lotId?: string;
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
  derivedStatus?: string;
  ean: string;
  imageUrl: string | null;
  listings: string[]; // platformIds
  notes: string;
  low: boolean; // niedriger Bestand (Zeilen-Markierung)
  availableQuantity: number;
  originalQuantity: number;
}

export function StockTable({
  rows,
  platforms,
  zmOptions,
  products,
  scope,
  requestedView,
  currentQuery,
}: {
  rows: StockRow[];
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  products: PickerProduct[];
  scope: Omit<TablePreferenceScope, "tableKey">;
  requestedView: string;
  currentQuery: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const legacyRows = rows.filter((row) => row.source === "legacy");

  const allSelected = legacyRows.length > 0 && selected.size === legacyRows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(legacyRows.map((r) => r.id)));
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

      <CompactTableShell
        definition={OPERATIONAL_MODULES.stock}
        scope={scope}
        requestedView={requestedView}
        viewParam="view"
        currentQuery={currentQuery}
        totalResults={rows.length}
      >
      <Card className="rounded-none border-0 shadow-none">
        <CardContent className="overflow-x-auto">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead data-column data-column-key="selection" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="sx-sticky-0 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Alle auswählen"
                    className="size-4"
                  />
                </TableHead>
                <TableHead data-column data-column-key="number" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="sx-sticky-1">Lager-Nr.</TableHead>
                <TableHead data-column data-column-key="date" data-view-standard data-view-purchasing data-view-all>Datum</TableHead>
                <TableHead data-column data-column-key="product" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all>Artikel</TableHead>
                <TableHead data-column data-column-key="quantity" data-view-standard data-view-stock data-view-inspection data-view-all className="text-right">Bestand</TableHead>
                <TableHead data-column data-column-key="cost" data-view-standard data-view-purchasing data-view-all className="text-right">EK netto</TableHead>
                <TableHead data-column data-column-key="payment" data-view-standard data-view-purchasing data-view-all>ZM</TableHead>
                <TableHead data-column data-column-key="purchase" data-view-purchasing data-view-all>Kauf</TableHead>
                <TableHead data-column data-column-key="return" data-view-purchasing data-view-all>Retoure</TableHead>
                <TableHead data-column data-column-key="status" data-view-standard data-view-stock data-view-inspection data-view-all>Bestandsstatus</TableHead>
                <TableHead data-column data-column-key="listings" data-view-standard data-view-listings data-view-all>Listings</TableHead>
                <TableHead data-column data-column-key="ean" data-view-purchasing data-view-listings data-view-all>EAN</TableHead>
                <TableHead data-column data-column-key="image" data-view-listings data-view-all>Bilder</TableHead>
                <TableHead data-column data-column-key="actions" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="w-36">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={13}
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
                  <TableCell data-column data-column-key="selection" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="sx-sticky-0">
                    {row.source === "legacy" ? (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={row.sku + " auswählen"}
                        className="size-4"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Neu</span>
                    )}
                  </TableCell>
                  <TableCell data-column data-column-key="number" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="sx-sticky-1 font-mono text-xs">{row.sku}</TableCell>
                  <TableCell data-column data-column-key="date" data-view-standard data-view-purchasing data-view-all className="whitespace-nowrap">{row.date}</TableCell>
                  <TableCell data-column data-column-key="product" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all className="sx-cell-primary min-w-56">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.variant, row.size].filter(Boolean).join(" · ") || "–"}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.supplier || "–"}</div>
                  </TableCell>
                  <TableCell data-column data-column-key="quantity" data-view-standard data-view-stock data-view-inspection data-view-all className="text-right font-mono">
                    {row.availableQuantity} / {row.originalQuantity}
                    <div className="text-xs text-muted-foreground">verfügbar</div>
                  </TableCell>
                  <TableCell data-column data-column-key="cost" data-view-standard data-view-purchasing data-view-all className="sx-cell-money text-right font-mono">
                    {row.netCents !== null ? formatEuro(row.netCents) : "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="payment" data-view-standard data-view-purchasing data-view-all className="whitespace-nowrap">{row.zm || "–"}</TableCell>
                  <TableCell data-column data-column-key="purchase" data-view-purchasing data-view-all>
                    <ColoredSelect
                      value={row.kaufStatus}
                      options={KAUF_STATUS_OPTIONS}
                      styles={ENTRY_STATUS}
                      titles={ENTRY_STATUS_TITLES}
                      disabled={pending}
                      onChange={(value) =>
                        run(() =>
                          row.source === "owned" && row.lotId
                            ? updateOwnedLotEntryStatusAction(
                                row.lotId,
                                "purchaseEntryStatus",
                                value as EntryStatus
                              )
                            : updateEntryStatusAction(row.id, "kaufStatus", value as EntryStatus)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell data-column data-column-key="return" data-view-purchasing data-view-all>
                    <ColoredSelect
                      value={row.retoureStatus}
                      options={RETOURE_STATUS_OPTIONS}
                      styles={ENTRY_STATUS}
                      titles={ENTRY_STATUS_TITLES}
                      disabled={pending}
                      onChange={(value) =>
                        run(() =>
                          row.source === "owned" && row.lotId
                            ? updateOwnedLotEntryStatusAction(
                                row.lotId,
                                "returnEntryStatus",
                                value as EntryStatus
                              )
                            : updateEntryStatusAction(row.id, "retoureStatus", value as EntryStatus)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell data-column data-column-key="status" data-view-standard data-view-stock data-view-inspection data-view-all>
                    {row.source === "owned" ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {row.derivedStatus}
                      </span>
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell data-column data-column-key="listings" data-view-standard data-view-listings data-view-all>
                    <ListingDetails
                      row={row}
                      platforms={platforms}
                      disabled={pending}
                      onToggle={(platformId, listed) =>
                        run(() =>
                          row.source === "owned"
                            ? toggleInventoryPositionListingAction(row.id, platformId, listed)
                            : toggleListingAction(row.id, platformId, listed)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell data-column data-column-key="ean" data-view-purchasing data-view-listings data-view-all className="font-mono text-xs">{row.ean || "–"}</TableCell>
                  <TableCell data-column data-column-key="image" data-view-listings data-view-all>
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
                  <TableCell data-column data-column-key="actions" data-view-standard data-view-purchasing data-view-listings data-view-stock data-view-inspection data-view-all>
                    <div className="flex justify-end gap-1">
                      <StockDetailDrawer row={row} platforms={platforms} />
                      {row.source === "owned" ? (
                        <QuantityAdjustmentDialog row={row} />
                      ) : (
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </CompactTableShell>
    </div>
  );
}

function StockDetailDrawer({
  row,
  platforms,
}: {
  row: StockRow;
  platforms: Array<{ id: string; name: string }>;
}) {
  const listingNames = platforms
    .filter((platform) => row.listings.includes(platform.id))
    .map((platform) => platform.name);

  return (
    <DetailDrawer title={row.sku} description={row.title}>
      <DetailSection title="Artikel">
        <DetailGrid
          items={[
            { label: "Name", value: row.title },
            { label: "Variante", value: row.variant || "–" },
            { label: "Größe", value: row.size || "–" },
            { label: "EAN", value: row.ean || "–" },
          ]}
        />
      </DetailSection>
      <DetailSection title="Einkauf">
        <DetailGrid
          items={[
            { label: "Datum", value: row.date },
            { label: "Händler", value: row.supplier || "–" },
            { label: "Zahlungsmethode", value: row.zm || "–" },
            { label: "VST", value: row.inputTaxDeductible ? "Ja" : "Nein" },
            { label: "Kaufstatus", value: row.kaufStatus },
            { label: "Retourenstatus", value: row.retoureStatus },
          ]}
        />
      </DetailSection>
      <DetailSection title="Finanzen">
        <DetailGrid
          items={[
            { label: "EK brutto", value: formatEuro(row.grossCents) },
            { label: "EK netto", value: row.netCents !== null ? formatEuro(row.netCents) : "–" },
          ]}
        />
      </DetailSection>
      <DetailSection title="Bestand">
        <DetailGrid
          items={[
            { label: "Verfügbar", value: row.availableQuantity },
            { label: "Ursprünglich", value: row.originalQuantity },
            { label: "Status", value: row.derivedStatus ?? STOCK_STATUS[row.status].label },
            { label: "Niedriger Bestand", value: row.low ? "Ja" : "Nein" },
          ]}
        />
      </DetailSection>
      <DetailSection title="Listings">
        <p>{listingNames.length ? listingNames.join(" · ") : "Keine Listings"}</p>
      </DetailSection>
      <DetailSection title="Bestandsverlauf">
        <p>Bewegungen liegen im InventoryMovement-Verlauf und bleiben prüfbar.</p>
      </DetailSection>
      {row.source === "legacy" && (
        <DetailSection title="Legacy-Importinformationen">
          <DetailGrid
            items={[
              { label: "Legacy-ID", value: row.id },
              { label: "Notizen", value: row.notes || "–" },
            ]}
          />
        </DetailSection>
      )}
    </DetailDrawer>
  );
}

function ListingDetails({
  row,
  platforms,
  disabled,
  onToggle,
}: {
  row: StockRow;
  platforms: Array<{ id: string; name: string }>;
  disabled: boolean;
  onToggle: (platformId: string, listed: boolean) => void;
}) {
  const listed = platforms.filter((platform) => row.listings.includes(platform.id));
  const visible = listed.slice(0, 2);
  const extra = Math.max(0, listed.length - visible.length);

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none flex-wrap gap-1">
        {visible.length === 0 ? (
          <span className="text-xs text-muted-foreground">Keine</span>
        ) : (
          visible.map((platform) => (
            <span key={platform.id} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {platform.name}
            </span>
          ))
        )}
        {extra > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">+{extra}</span>
        )}
      </summary>
      <div className="absolute z-20 mt-2 min-w-48 rounded-md border bg-popover p-2 text-popover-foreground shadow">
        {platforms.map((platform) => (
          <label key={platform.id} className="flex items-center gap-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={row.listings.includes(platform.id)}
              disabled={disabled}
              onChange={(event) => onToggle(platform.id, event.target.checked)}
              className="size-4"
            />
            {platform.name}
          </label>
        ))}
      </div>
    </details>
  );
}

function QuantityAdjustmentDialog({ row }: { row: StockRow }) {
  const action = adjustOwnedInventoryQuantityAction.bind(null, row.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none">
        <Button variant="ghost" size="sm" type="button">
          Korrektur
        </Button>
      </summary>
      <form
        action={formAction}
        className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow"
      >
        <div className="text-sm font-medium">Bestand korrigieren</div>
        <select
          name="direction"
          defaultValue="IN"
          className="border-input h-8 w-full rounded-md border bg-background px-2 text-xs"
        >
          <option value="IN">Differenz +</option>
          <option value="OUT">Differenz -</option>
        </select>
        <select
          name="bucket"
          defaultValue="AVAILABLE"
          className="border-input h-8 w-full rounded-md border bg-background px-2 text-xs"
        >
          <option value="AVAILABLE">Verfügbar</option>
          <option value="INSPECTION">In Prüfung</option>
          <option value="DEFECTIVE">Defekt</option>
          <option value="RESERVED">Reserviert</option>
        </select>
        <input
          name="quantity"
          type="number"
          min={1}
          max={500}
          defaultValue={1}
          className="border-input h-8 w-full rounded-md border bg-background px-2 text-xs"
        />
        <input
          name="comment"
          required
          placeholder="Grund / Kommentar"
          className="border-input h-8 w-full rounded-md border bg-background px-2 text-xs"
        />
        <Button type="submit" size="sm" disabled={pending} className="w-full">
          Buchen
        </Button>
      </form>
    </details>
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
