"use client";

import Link from "next/link";
import type { PurchaseShippingStatus, PurchaseStatus } from "@prisma/client";
import { formatEuro } from "@/lib/calculations";
import { classifyReturnDeadline } from "@/lib/services/owned-purchase-service";
import { PURCHASE_TABLE_DEFINITION, type PurchaseTableQuery } from "@/lib/purchases/purchase-table";
import type { TablePreferenceScope } from "@/lib/operational-table";
import { EmptyState } from "@/components/app/states";
import { PurchaseEditDialog, PurchaseReceiptDialog } from "@/components/purchases/purchase-dialogs";
import {
  PurchaseShippingStatusSelect,
  PurchaseStatusSelect,
} from "@/components/purchases/purchase-inline-statuses";
import { CancelPurchaseButton, CancelPurchaseReceiptButton } from "@/components/purchases/purchase-cancellation-actions";
import { DetailDrawer, DetailGrid, DetailSection } from "@/components/table/detail-drawer";
import { OperationalPagination } from "@/components/table/operational-pagination";
import { OperationalTableWorkspace, TableSelectionCheckbox } from "@/components/table/operational-table-workspace";
import { TableSortHeader } from "@/components/table/table-sort-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PurchaseOperationalRow {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplier: string;
  supplierOrderNumber: string;
  status: PurchaseStatus;
  shippingStatus: PurchaseShippingStatus;
  shippingCarrier: string;
  trackingNumber: string;
  expectedDeliveryAt: string | null;
  receivedAt: string | null;
  returnDeadline: string | null;
  grossCents: number;
  netCents: number;
  paymentMethod: string;
  comment: string;
  debtCount: number;
  lines: Array<{ id: string; productId: string; product: string; imageUrl: string | null; condition: string | null; quantity: number; received: number; grossCents: number; unitGrossCents: number; netCents: number }>;
  receipts: Array<{ id: string; receivedAt: string; cancelledAt: string | null; lines: Array<{ product: string; quantity: number }> }>;
  lots: Array<{ inventoryNumber: string; quantity: number; receivedAt: string; movementId: string; cancelled: boolean }>;
}

const columns = PURCHASE_TABLE_DEFINITION.columns.map((column) => ({ key: column.key, label: column.label, required: column.key === "purchaseNumber" }));
const defaults = PURCHASE_TABLE_DEFINITION.columns.filter((column) => column.defaultVisible).map((column) => column.key);

export function PurchaseTable({ rows, totalResults, query, queryString, scope, nowIso, suppliers, paymentMethods }: { rows: PurchaseOperationalRow[]; totalResults: number; query: PurchaseTableQuery; queryString: string; scope: TablePreferenceScope; nowIso: string; suppliers: Array<{ id: string; label: string }>; paymentMethods: string[] }) {
  return <div className="overflow-hidden border bg-card shadow-xs">
    <OperationalTableWorkspace
      scope={scope}
      columns={columns}
      defaultVisibleColumns={defaults}
      pageRowIds={rows.map((row) => row.id)}
      totalResults={totalResults}
      currentQuery={queryString}
      renderTable={(state) => <>
        <Table className="sx-datatable min-w-max">
          <TableHeader><TableRow>
            <TableHead className="sx-sticky-0 w-10"><TableSelectionCheckbox checked={state.pageSelection} onCheckedChange={state.togglePage} label="Alle Einkäufe auf dieser Seite auswählen" /></TableHead>
            {state.visibleColumns.has("purchaseNumber") && <TableHead data-column-key="purchaseNumber" className="sx-sticky-1"><Sort label="Einkauf" column="purchaseNumber" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("purchaseDate") && <TableHead data-column-key="purchaseDate"><Sort label="Bestelldatum" column="purchaseDate" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("supplier") && <TableHead data-column-key="supplier"><Sort label="Lieferant" column="supplier" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("status") && <TableHead data-column-key="status"><Sort label="Bestellstatus" column="status" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("shipping") && <TableHead data-column-key="shipping"><Sort label="Versand" column="shipping" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("lines") && <TableHead data-column-key="lines">Positionen</TableHead>}
            {state.visibleColumns.has("amounts") && <TableHead data-column-key="amounts" className="text-right"><Sort label="Brutto / Netto" column="amounts" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("paymentMethod") && <TableHead data-column-key="paymentMethod">Zahlungsmethode</TableHead>}
            {state.visibleColumns.has("expectedDelivery") && <TableHead data-column-key="expectedDelivery"><Sort label="Erwartet" column="expectedDelivery" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("receivedAt") && <TableHead data-column-key="receivedAt"><Sort label="Eingetroffen" column="receivedAt" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("returnDeadline") && <TableHead data-column-key="returnDeadline"><Sort label="Rückgabefrist" column="returnDeadline" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("supplierOrder") && <TableHead data-column-key="supplierOrder"><Sort label="Lieferantenbestellung" column="supplierOrder" query={query} queryString={queryString} /></TableHead>}
            {state.visibleColumns.has("tracking") && <TableHead data-column-key="tracking">Tracking</TableHead>}
            {state.visibleColumns.has("tax") && <TableHead data-column-key="tax">Steuer</TableHead>}
            {state.visibleColumns.has("debt") && <TableHead data-column-key="debt">Schuld</TableHead>}
            {state.visibleColumns.has("comment") && <TableHead data-column-key="comment">Notiz</TableHead>}
            <TableHead>Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={20} className="p-0"><EmptyState title="Keine Einkäufe in dieser Ansicht" description="Passe Suche oder Filter an – oder erfasse die erste Bestellung." /></TableCell></TableRow> : rows.map((row) => {
            const selected = state.isSelected(row.id);
            const openLines = row.lines.filter((line) => line.received < line.quantity).map((line) => ({ id: line.id, label: line.product, openQuantity: line.quantity - line.received }));
            const receivedTotal = row.lines.reduce((sum, line) => sum + line.received, 0);
            const orderedTotal = row.lines.reduce((sum, line) => sum + line.quantity, 0);
            return <TableRow key={row.id} data-row-id={row.id} data-selected={selected}>
              <TableCell className="sx-sticky-0"><TableSelectionCheckbox checked={selected} onCheckedChange={() => state.toggleRow(row.id)} label={`${row.purchaseNumber} auswählen`} /></TableCell>
              {state.visibleColumns.has("purchaseNumber") && <TableCell data-column-key="purchaseNumber" className="sx-sticky-1 font-mono font-medium">{row.purchaseNumber}</TableCell>}
              {state.visibleColumns.has("purchaseDate") && <TableCell data-column-key="purchaseDate">{date(row.purchaseDate)}</TableCell>}
              {state.visibleColumns.has("supplier") && <TableCell data-column-key="supplier">{row.supplier}</TableCell>}
              {state.visibleColumns.has("status") && <TableCell data-column-key="status"><PurchaseStatusSelect purchaseId={row.id} status={row.status} /></TableCell>}
              {state.visibleColumns.has("shipping") && <TableCell data-column-key="shipping"><PurchaseShippingStatusSelect purchaseId={row.id} status={row.shippingStatus} cancelled={row.status === "CANCELLED"} /></TableCell>}
              {state.visibleColumns.has("lines") && <TableCell data-column-key="lines">{row.lines.length} · {receivedTotal}/{orderedTotal} Stk.</TableCell>}
              {state.visibleColumns.has("amounts") && <TableCell data-column-key="amounts" className="text-right"><span className="font-medium">{formatEuro(row.grossCents)}</span><br/><span className="text-xs text-muted-foreground">{formatEuro(row.netCents)} netto</span></TableCell>}
              {state.visibleColumns.has("paymentMethod") && <TableCell data-column-key="paymentMethod">{row.paymentMethod}</TableCell>}
              {state.visibleColumns.has("expectedDelivery") && <TableCell data-column-key="expectedDelivery">{date(row.expectedDeliveryAt)}</TableCell>}
              {state.visibleColumns.has("receivedAt") && <TableCell data-column-key="receivedAt">{date(row.receivedAt)}</TableCell>}
              {state.visibleColumns.has("returnDeadline") && <TableCell data-column-key="returnDeadline"><Deadline value={row.returnDeadline} nowIso={nowIso} /></TableCell>}
              {state.visibleColumns.has("supplierOrder") && <TableCell data-column-key="supplierOrder">{row.supplierOrderNumber || "–"}</TableCell>}
              {state.visibleColumns.has("tracking") && <TableCell data-column-key="tracking">{[row.shippingCarrier, row.trackingNumber].filter(Boolean).join(" · ") || "–"}</TableCell>}
              {state.visibleColumns.has("tax") && <TableCell data-column-key="tax">{row.lines.some((line) => line.netCents !== line.grossCents) ? "VSt. abziehbar" : "brutto"}</TableCell>}
              {state.visibleColumns.has("debt") && <TableCell data-column-key="debt">{row.debtCount ? `${row.debtCount} verknüpft` : "–"}</TableCell>}
              {state.visibleColumns.has("comment") && <TableCell data-column-key="comment" className="max-w-56 truncate">{row.comment || "–"}</TableCell>}
              <TableCell><div className="flex flex-wrap gap-1">
                {row.status !== "CANCELLED" ? <PurchaseReceiptDialog purchaseId={row.id} purchaseNumber={row.purchaseNumber} lines={openLines} /> : null}
                {row.status !== "CANCELLED" ? <PurchaseEditDialog purchase={row} suppliers={suppliers} paymentMethods={paymentMethods} /> : null}
                <PurchaseDetails row={row} nowIso={nowIso} />
              </div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        <OperationalPagination page={query.page} pageSize={query.pageSize} totalResults={totalResults} query={queryString} />
      </>}
    />
  </div>;
}

function PurchaseDetails({ row, nowIso }: { row: PurchaseOperationalRow; nowIso: string }) {
  return <DetailDrawer title={row.purchaseNumber} description={`${row.supplier} · ${date(row.purchaseDate)}`}>
    <DetailGrid items={[
      { label: "Lieferanten-Bestellnr.", value: row.supplierOrderNumber || "–" },
      { label: "Versanddienstleister", value: row.shippingCarrier || "–" },
      { label: "Tracking", value: row.trackingNumber || "–" },
      { label: "Rückgabefrist", value: <Deadline value={row.returnDeadline} nowIso={nowIso} /> },
    ]} />
    <DetailSection title="Positionen">
      {row.lines.map((line) => (
        <div key={line.id} className="mb-3 flex flex-wrap items-center justify-between gap-3 border p-3">
          <div className="flex min-w-0 items-center gap-3">
            {line.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Externe Nutzer-URLs haben keine vorab bekannte Hostliste.
              <img src={line.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-14 shrink-0 border bg-muted object-contain" />
            ) : null}
            <p>{line.product}: {line.received}/{line.quantity} · {formatEuro(line.grossCents)}</p>
          </div>
          <span className="flex gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/finanzen/preisrechner/ebay?productId=${line.productId}&purchasePriceCents=${line.unitGrossCents}${line.condition ? `&condition=${line.condition}` : ""}`}>eBay kalkulieren</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/finanzen/preisrechner/kaufland?productId=${line.productId}&purchasePriceCents=${line.unitGrossCents}`}>Kaufland kalkulieren</Link>
            </Button>
          </span>
        </div>
      ))}
    </DetailSection>
    <DetailSection title="Wareneingänge"><ReceiptList row={row} /></DetailSection>
    <DetailSection title="Lots und Bewegungen">{row.lots.length ? row.lots.map((lot) => <p key={lot.inventoryNumber} className={lot.cancelled ? "text-muted-foreground line-through" : undefined}><span className="font-mono">{lot.inventoryNumber}</span> · {lot.quantity} Stk. · {date(lot.receivedAt)} · Movement {lot.movementId}</p>) : <p>Noch kein Wareneingang.</p>}</DetailSection>
    {row.status !== "CANCELLED" ? <DetailSection title="Bestellung stornieren"><p className="mb-2 text-sm text-muted-foreground">Storniert die gesamte Bestellung. Noch vollständig vorhandene Wareneingänge werden dabei aus dem Lager zurückgebucht.</p><CancelPurchaseButton purchaseId={row.id} /></DetailSection> : null}
  </DetailDrawer>;
}

function ReceiptList({ row }: { row: PurchaseOperationalRow }) {
  if (row.receipts.length === 0) return <p>Noch kein Wareneingang.</p>;
  return row.receipts.map((receipt) => <div key={receipt.id} className="mb-2 flex flex-wrap items-center justify-between gap-3 border p-3"><div><p className="text-sm font-medium">{date(receipt.receivedAt)} · {receipt.lines.reduce((sum, line) => sum + line.quantity, 0)} Stk.</p><p className="text-xs text-muted-foreground">{receipt.lines.map((line) => `${line.product}: ${line.quantity}`).join(" · ")}</p>{receipt.cancelledAt ? <p className="text-xs text-destructive">Storniert am {date(receipt.cancelledAt)}</p> : null}</div>{!receipt.cancelledAt && row.status !== "CANCELLED" ? <CancelPurchaseReceiptButton receiptId={receipt.id} /> : null}</div>);
}

function Sort({ label, column, query, queryString }: { label: string; column: string; query: PurchaseTableQuery; queryString: string }) { return <TableSortHeader label={label} column={column} currentSort={query.sort} direction={query.direction} query={queryString} />; }
const DEADLINE_LABELS: Record<ReturnType<typeof classifyReturnDeadline>, string> = {
  NONE: "–",
  OVERDUE: "abgelaufen",
  DUE_SOON: "bald fällig",
  ACTIVE: "aktiv",
};

function Deadline({ value, nowIso }: { value: string | null; nowIso: string }) {
  if (!value) return <>–</>;
  const state = classifyReturnDeadline(new Date(value), new Date(nowIso));
  return <span className={cn(
    "inline-flex border px-2 py-1 text-xs font-medium",
    state === "OVERDUE" && "border-red-400 bg-red-50 text-red-800",
    state === "DUE_SOON" && "border-amber-400 bg-amber-50 text-amber-900",
    state === "ACTIVE" && "border-emerald-300 bg-emerald-50 text-emerald-800"
  )}>{date(value)} · {DEADLINE_LABELS[state]}</span>;
}
function date(value: string | null) { return value ? new Date(value).toLocaleDateString("de-DE") : "–"; }
