"use client";

import { formatEuro } from "@/lib/calculations";
import { classifyReturnDeadline } from "@/lib/services/owned-purchase-service";
import { PURCHASE_TABLE_DEFINITION, type PurchaseTableQuery } from "@/lib/purchases/purchase-table";
import type { TablePreferenceScope } from "@/lib/operational-table";
import { EmptyState } from "@/components/app/states";
import { PurchaseReceiptDialog } from "@/components/purchases/purchase-dialogs";
import { DetailDrawer, DetailGrid, DetailSection } from "@/components/table/detail-drawer";
import { OperationalPagination } from "@/components/table/operational-pagination";
import { OperationalTableWorkspace, TableSelectionCheckbox } from "@/components/table/operational-table-workspace";
import { TableSortHeader } from "@/components/table/table-sort-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface PurchaseOperationalRow {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplier: string;
  supplierOrderNumber: string;
  status: string;
  shippingStatus: string;
  shippingCarrier: string;
  trackingNumber: string;
  expectedDeliveryAt: string | null;
  receivedAt: string | null;
  returnDeadline: string | null;
  grossCents: number;
  netCents: number;
  paymentAccount: string;
  paymentMethod: string;
  documentReference: string;
  comment: string;
  debtCount: number;
  lines: Array<{ id: string; product: string; quantity: number; received: number; grossCents: number; netCents: number }>;
  lots: Array<{ inventoryNumber: string; quantity: number; receivedAt: string; movementId: string }>;
}

const columns = PURCHASE_TABLE_DEFINITION.columns.map((column) => ({ key: column.key, label: column.label, required: column.key === "purchaseNumber" }));
const defaults = PURCHASE_TABLE_DEFINITION.columns.filter((column) => column.defaultVisible).map((column) => column.key);

export function PurchaseTable({ rows, totalResults, query, queryString, scope, nowIso }: { rows: PurchaseOperationalRow[]; totalResults: number; query: PurchaseTableQuery; queryString: string; scope: TablePreferenceScope; nowIso: string }) {
  return <div className="overflow-hidden border bg-card shadow-xs">
    <OperationalTableWorkspace
      scope={scope}
      basePath="/einkauf"
      columns={columns}
      defaultVisibleColumns={defaults}
      pageRowIds={rows.map((row) => row.id)}
      totalResults={totalResults}
      currentQuery={queryString}
      renderTable={(state) => <>
        <Table className="sx-datatable min-w-max">
          <TableHeader><TableRow>
            <TableHead className="sx-sticky-0 w-10"><TableSelectionCheckbox checked={state.pageSelection} onCheckedChange={state.togglePage} label="Alle Einkäufe auf dieser Seite auswählen" /></TableHead>
            {state.visibleColumns.has("purchaseNumber") && <TableHead className="sx-sticky-1"><Sort label="Einkauf" column="purchaseNumber" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("purchaseDate") && <TableHead><Sort label="Bestelldatum" column="purchaseDate" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("supplier") && <TableHead><Sort label="Lieferant" column="supplier" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("status") && <TableHead><Sort label="Bestellstatus" column="status" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("shipping") && <TableHead><Sort label="Versand" column="shipping" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("lines") && <TableHead>Positionen</TableHead>}
            {state.visibleColumns.has("amounts") && <TableHead className="text-right"><Sort label="Brutto / Netto" column="amounts" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("paymentAccount") && <TableHead>Zahlungskonto</TableHead>}
            {state.visibleColumns.has("expectedDelivery") && <TableHead><Sort label="Erwartet" column="expectedDelivery" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("receivedAt") && <TableHead><Sort label="Eingetroffen" column="receivedAt" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("returnDeadline") && <TableHead><Sort label="Rückgabefrist" column="returnDeadline" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("supplierOrder") && <TableHead><Sort label="Lieferantenbestellung" column="supplierOrder" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("tracking") && <TableHead>Tracking</TableHead>}
            {state.visibleColumns.has("tax") && <TableHead>Steuer</TableHead>}
            {state.visibleColumns.has("debt") && <TableHead>Schuld</TableHead>}
            {state.visibleColumns.has("comment") && <TableHead>Notiz</TableHead>}
            <TableHead>Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={20} className="p-0"><EmptyState title="Keine Einkäufe in dieser Ansicht" description="Passe Suche oder Filter an – oder erfasse die erste Bestellung." /></TableCell></TableRow> : rows.map((row) => {
            const selected = state.isSelected(row.id);
            const openLines = row.lines.filter((line) => line.received < line.quantity).map((line) => ({ id: line.id, label: line.product, openQuantity: line.quantity - line.received }));
            return <TableRow key={row.id} data-selected={selected}>
              <TableCell className="sx-sticky-0"><TableSelectionCheckbox checked={selected} onCheckedChange={() => state.toggleRow(row.id)} label={`${row.purchaseNumber} auswählen`} /></TableCell>
              {state.visibleColumns.has("purchaseNumber") && <TableCell className="sx-sticky-1 font-mono font-medium">{row.purchaseNumber}</TableCell>}
              {state.visibleColumns.has("purchaseDate") && <TableCell>{date(row.purchaseDate)}</TableCell>}
              {state.visibleColumns.has("supplier") && <TableCell>{row.supplier}</TableCell>}
              {state.visibleColumns.has("status") && <TableCell><Status value={row.status} /></TableCell>}
              {state.visibleColumns.has("shipping") && <TableCell><Status value={row.shippingStatus} /></TableCell>}
              {state.visibleColumns.has("lines") && <TableCell>{row.lines.length} · {row.lines.reduce((sum, line) => sum + line.received, 0)}/{row.lines.reduce((sum, line) => sum + line.quantity, 0)} Stk.</TableCell>}
              {state.visibleColumns.has("amounts") && <TableCell className="text-right"><span className="font-medium">{formatEuro(row.grossCents)}</span><br/><span className="text-xs text-muted-foreground">{formatEuro(row.netCents)} netto</span></TableCell>}
              {state.visibleColumns.has("paymentAccount") && <TableCell>{row.paymentAccount || row.paymentMethod}</TableCell>}
              {state.visibleColumns.has("expectedDelivery") && <TableCell>{date(row.expectedDeliveryAt)}</TableCell>}
              {state.visibleColumns.has("receivedAt") && <TableCell>{date(row.receivedAt)}</TableCell>}
              {state.visibleColumns.has("returnDeadline") && <TableCell><Deadline value={row.returnDeadline} nowIso={nowIso} /></TableCell>}
              {state.visibleColumns.has("supplierOrder") && <TableCell>{row.supplierOrderNumber || "–"}</TableCell>}
              {state.visibleColumns.has("tracking") && <TableCell>{[row.shippingCarrier, row.trackingNumber].filter(Boolean).join(" · ") || "–"}</TableCell>}
              {state.visibleColumns.has("tax") && <TableCell>{row.lines.some((line) => line.netCents !== line.grossCents) ? "VSt. abziehbar" : "brutto"}</TableCell>}
              {state.visibleColumns.has("debt") && <TableCell>{row.debtCount ? `${row.debtCount} verknüpft` : "–"}</TableCell>}
              {state.visibleColumns.has("comment") && <TableCell className="max-w-56 truncate">{row.comment || "–"}</TableCell>}
              <TableCell><div className="flex gap-1"><PurchaseReceiptDialog purchaseId={row.id} purchaseNumber={row.purchaseNumber} lines={openLines} /><DetailDrawer title={row.purchaseNumber} description={`${row.supplier} · ${date(row.purchaseDate)}`}><DetailGrid items={[{ label: "Lieferanten-Bestellnr.", value: row.supplierOrderNumber || "–" }, { label: "Tracking", value: row.trackingNumber || "–" }, { label: "Beleg", value: row.documentReference || "–" }, { label: "Rückgabefrist", value: <Deadline value={row.returnDeadline} nowIso={nowIso} /> }]} /><DetailSection title="Positionen">{row.lines.map((line) => <p key={line.id}>{line.product}: {line.received}/{line.quantity} · {formatEuro(line.grossCents)}</p>)}</DetailSection><DetailSection title="Lots und Bewegungen">{row.lots.length ? row.lots.map((lot) => <p key={lot.inventoryNumber}><span className="font-mono">{lot.inventoryNumber}</span> · {lot.quantity} Stk. · {date(lot.receivedAt)} · Movement {lot.movementId}</p>) : <p>Noch kein Wareneingang.</p>}</DetailSection></DetailDrawer></div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        <OperationalPagination page={query.page} pageSize={query.pageSize} totalResults={totalResults} query={queryString} />
      </>}
    />
  </div>;
}

function Sort({ label, column, query, queryString }: { label: string; column: string; query: PurchaseTableQuery; queryString: string }) { return <TableSortHeader label={label} column={column} currentSort={query.sort} direction={query.direction} query={queryString} />; }
function Status({ value }: { value: string }) { return <span className="inline-flex border px-2 py-1 text-xs font-medium">{value.replaceAll("_", " ")}</span>; }
function Deadline({ value, nowIso }: { value: string | null; nowIso: string }) { if (!value) return <>–</>; const state = classifyReturnDeadline(new Date(value), new Date(nowIso)); return <span className={cn("inline-flex border px-2 py-1 text-xs font-medium", state === "OVERDUE" && "border-red-400 bg-red-50 text-red-800", state === "DUE_SOON" && "border-amber-400 bg-amber-50 text-amber-900", state === "ACTIVE" && "border-emerald-300 bg-emerald-50 text-emerald-800")}>{date(value)} · {state === "OVERDUE" ? "abgelaufen" : state === "DUE_SOON" ? "bald fällig" : "aktiv"}</span>; }
function date(value: string | null) { return value ? new Date(value).toLocaleDateString("de-DE") : "–"; }
