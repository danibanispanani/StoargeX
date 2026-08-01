import type { Prisma, SupplierReturnStatus } from "@prisma/client";
import { CreateSupplierReturnDialog, type SupplierReturnPurchaseOption } from "@/components/returns/create-supplier-return-dialog";
import { SupplierReturnActions } from "@/components/returns/supplier-return-actions";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import { PageHeader } from "@/components/app/page-header";
import { DetailDrawer, DetailGrid, DetailSection } from "@/components/table/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEuro } from "@/lib/calculations";
import { requireOrg } from "@/lib/org";
import { MAX_TABLE_PAGE_SIZE } from "@/lib/operational-table";
import { getSupplierReturnDeadlineState } from "@/lib/services/supplier-return-service";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { OperationalSearchToolbar } from "@/components/table/operational-search-toolbar";

const STATUS_LABELS: Record<SupplierReturnStatus, string> = {
  DRAFT: "Geplant",
  REQUESTED: "Angefragt",
  APPROVED: "Genehmigt",
  DISPATCHED: "Versendet",
  ARRIVED: "Beim Lieferanten",
  REFUND_PENDING: "Erstattung offen",
  PARTIALLY_REFUNDED: "Teilweise erstattet",
  REFUNDED: "Vollständig erstattet",
  REJECTED: "Abgelehnt",
  CREDIT_PENDING: "Gutschrift offen",
  REPLACEMENT_PENDING: "Ersatz offen",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

type SupplierReturnRow = Prisma.SupplierReturnGetPayload<{
  include: {
    purchase: true;
    supplier: true;
    lines: {
      include: {
        purchaseLine: { include: { product: true } };
        inventoryPosition: true;
        outboundMovement: true;
      };
    };
  };
}>;

export default async function SupplierReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const { db, organization, userId } = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(
    OPERATIONAL_MODULES.supplierReturns,
    preset
  );
  const [supplierReturns, purchases] = await Promise.all([
    db.supplierReturn.findMany({
      where: q
        ? {
            OR: [
              { returnNumber: { contains: q, mode: "insensitive" } },
              { supplierSnapshot: { contains: q, mode: "insensitive" } },
              { rmaNumber: { contains: q, mode: "insensitive" } },
              { trackingNumber: { contains: q, mode: "insensitive" } },
              { purchase: { purchaseNumber: { contains: q, mode: "insensitive" } } },
              {
                lines: {
                  some: {
                    purchaseLine: {
                      product: { name: { contains: q, mode: "insensitive" } },
                    },
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        purchase: true,
        supplier: true,
        lines: {
          include: {
            purchaseLine: { include: { product: true } },
            inventoryPosition: true,
            outboundMovement: true,
          },
        },
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      take: MAX_TABLE_PAGE_SIZE,
    }),
    db.purchase.findMany({
      where: { purchaseStatus: { not: "CANCELLED" }, lines: { some: { ownedLots: { some: {} } } } },
      include: {
        lines: {
          include: {
            product: true,
            ownedLots: { include: { inventoryPosition: true } },
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
      take: MAX_TABLE_PAGE_SIZE,
    }),
  ]);

  const purchaseOptions: SupplierReturnPurchaseOption[] = purchases.map((purchase) => ({
    id: purchase.id,
    label: `${purchase.purchaseNumber} · ${purchase.vendor} · ${purchase.purchaseDate.toLocaleDateString("de-DE")}`,
    search: [purchase.purchaseNumber, purchase.vendor, ...purchase.lines.map((line) => line.product.name)].join(" "),
    returnDeadline: purchase.returnDeadline?.toISOString().slice(0, 10) ?? null,
    lines: purchase.lines.map((line) => ({
      id: line.id,
      label: [line.product.name, line.product.variant, line.product.size].filter(Boolean).join(" · "),
      positions: line.ownedLots.map((lot) => ({
        id: lot.inventoryPosition.id,
        inventoryNumber: lot.inventoryPosition.inventoryNumber,
        itemCondition: lot.inventoryPosition.itemCondition,
        buckets: [
          { key: "AVAILABLE" as const, quantity: lot.inventoryPosition.quantityAvailable },
          { key: "RESERVED" as const, quantity: lot.inventoryPosition.quantityReserved },
          { key: "INSPECTION" as const, quantity: lot.inventoryPosition.quantityInspection },
          { key: "DEFECTIVE" as const, quantity: lot.inventoryPosition.quantityDefective },
        ],
      })).filter((position) => position.buckets.some((bucket) => bucket.quantity > 0)),
    })).filter((line) => line.positions.length > 0),
  })).filter((purchase) => purchase.lines.length > 0);

  const visibleReturnCount = supplierReturns.filter((ret) => {
    if (requestedView === "deadlines") {
      return Boolean(ret.returnDeadline) && !["COMPLETED", "CANCELLED", "REJECTED"].includes(ret.status);
    }
    if (requestedView === "shipping") {
      return ["APPROVED", "DISPATCHED", "ARRIVED"].includes(ret.status);
    }
    if (requestedView === "refund") {
      return ["DISPATCHED", "ARRIVED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CREDIT_PENDING"].includes(ret.status);
    }
    if (requestedView === "conflicts") {
      return ret.status === "REJECTED" || ret.status === "CANCELLED"
        || (ret.actualRefundCents > 0 && ret.actualRefundCents < ret.expectedRefundCents);
    }
    return true;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Handel · Retouren"
        title="Lieferantenretouren"
        description="Rücksendungen an Lieferanten und erwartete Erstattungen steuern."
        actions={<CreateSupplierReturnDialog purchases={purchaseOptions} />}
      />
      <OperationalSearchToolbar
        basePath="/retouren/lieferanten"
        query={q ?? ""}
        placeholder="LR-Nummer, Einkauf, Lieferant, Artikel, RMA oder Tracking"
        hiddenParams={{ preset: requestedView === "standard" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.supplierReturns}
        scope={{ organizationId: organization.id, userId }}
        currentQuery={operationalSearchParams({
          preset: requestedView === "standard" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleReturnCount}
      >
        <Card className="rounded-none border-0 shadow-none"><CardContent><Table className="sx-datatable">
          <TableHeader><TableRow>
            <TableHead data-column data-column-key="number" data-view-standard data-view-deadlines data-view-shipping data-view-refund data-view-conflicts data-view-all>LR-Nummer</TableHead>
            <TableHead data-column data-column-key="purchase" data-view-standard data-view-all>Einkauf / Lieferant</TableHead>
            <TableHead data-column data-column-key="items" data-view-standard data-view-shipping data-view-all>Positionen</TableHead>
            <TableHead data-column data-column-key="quantity" data-view-standard data-view-all className="text-right">Menge</TableHead>
            <TableHead data-column data-column-key="deadline" data-view-standard data-view-deadlines data-view-all>Frist</TableHead>
            <TableHead data-column data-column-key="shipping" data-view-shipping data-view-all>Versand</TableHead>
            <TableHead data-column data-column-key="expected" data-view-refund data-view-all className="text-right">Erwartet</TableHead>
            <TableHead data-column data-column-key="actual" data-view-refund data-view-conflicts data-view-all className="text-right">Tatsächlich / Differenz</TableHead>
            <TableHead data-column data-column-key="status" data-view-standard data-view-deadlines data-view-shipping data-view-refund data-view-conflicts data-view-all>Status</TableHead>
            <TableHead data-column data-column-key="actions" data-view-standard data-view-shipping data-view-refund data-view-conflicts data-view-all>Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {supplierReturns.length === 0 && <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Noch keine Lieferantenretouren. Eine Planung verändert den Bestand nicht.</TableCell></TableRow>}
            {supplierReturns.map((ret) => {
              const quantity = ret.lines.reduce((sum, line) => sum + line.quantity, 0);
              const difference = ret.actualRefundCents - ret.expectedRefundCents;
              const deadlineRelevant = Boolean(ret.returnDeadline) && !["COMPLETED", "CANCELLED", "REJECTED"].includes(ret.status);
              const shippingRelevant = ["APPROVED", "DISPATCHED", "ARRIVED"].includes(ret.status);
              const refundRelevant = ["DISPATCHED", "ARRIVED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CREDIT_PENDING"].includes(ret.status);
              const conflictRelevant = ret.status === "REJECTED" || ret.status === "CANCELLED" || (ret.actualRefundCents > 0 && difference < 0);
              return <TableRow
                key={ret.id}
                data-table-view-row
                data-row-view-standard
                data-row-view-deadlines={deadlineRelevant || undefined}
                data-row-view-shipping={shippingRelevant || undefined}
                data-row-view-refund={refundRelevant || undefined}
                data-row-view-conflicts={conflictRelevant || undefined}
                data-row-view-all
              >
                <TableCell data-column data-column-key="number" data-view-standard data-view-deadlines data-view-shipping data-view-refund data-view-conflicts data-view-all className="font-mono text-xs">{ret.returnNumber ?? ret.id.slice(0, 8)}</TableCell>
                <TableCell data-column data-column-key="purchase" data-view-standard data-view-all><div className="font-mono text-xs">{ret.purchase.purchaseNumber}</div><div className="text-xs text-muted-foreground">{ret.supplier?.displayName ?? ret.supplierSnapshot}</div></TableCell>
                <TableCell data-column data-column-key="items" data-view-standard data-view-shipping data-view-all className="max-w-72"><div className="truncate font-medium">{ret.lines.map((line) => line.purchaseLine.product.name).join(", ")}</div><div className="truncate font-mono text-xs text-muted-foreground">{ret.lines.map((line) => `${line.inventoryPosition.inventoryNumber} · ${bucketLabel(line.sourceBucket)}`).join(" · ")}</div></TableCell>
                <TableCell data-column data-column-key="quantity" data-view-standard data-view-all className="text-right">{quantity}</TableCell>
                <TableCell data-column data-column-key="deadline" data-view-standard data-view-deadlines data-view-all><Deadline value={ret.returnDeadline} /></TableCell>
                <TableCell data-column data-column-key="shipping" data-view-shipping data-view-all><div>{ret.carrier ?? "–"}</div><div className="font-mono text-xs text-muted-foreground">{ret.trackingNumber ?? "kein Tracking"}</div></TableCell>
                <TableCell data-column data-column-key="expected" data-view-refund data-view-all className="sx-cell-money text-right">{formatEuro(ret.expectedRefundCents)}</TableCell>
                <TableCell data-column data-column-key="actual" data-view-refund data-view-conflicts data-view-all className="sx-cell-money text-right"><div>{formatEuro(ret.actualRefundCents)}</div><div className={cn("text-xs", difference < 0 ? "text-destructive" : "text-muted-foreground")}>{difference > 0 ? "+" : ""}{formatEuro(difference)}</div></TableCell>
                <TableCell data-column data-column-key="status" data-view-standard data-view-deadlines data-view-shipping data-view-refund data-view-conflicts data-view-all><Badge variant={ret.status === "REJECTED" ? "destructive" : "outline"}>{STATUS_LABELS[ret.status]}</Badge></TableCell>
                <TableCell data-column data-column-key="actions" data-view-standard data-view-shipping data-view-refund data-view-conflicts data-view-all><div className="space-y-2"><SupplierReturnDetail ret={ret} /><SupplierReturnActions supplierReturnId={ret.id} status={ret.status} /></div></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table></CardContent></Card>
      </CompactTableShell>
    </div>
  );
}

function Deadline({ value }: { value: Date | null }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  const state = getSupplierReturnDeadlineState(value);
  return <span className={cn("inline-flex border px-2 py-1 text-xs font-medium", state === "OVERDUE" && "border-red-400 bg-red-50 text-red-800", state === "DUE_SOON" && "border-amber-400 bg-amber-50 text-amber-900", state === "ON_TRACK" && "border-emerald-300 bg-emerald-50 text-emerald-800")}>{value.toLocaleDateString("de-DE")} · {state === "OVERDUE" ? "abgelaufen" : state === "DUE_SOON" ? "bald fällig" : "aktiv"}</span>;
}

function SupplierReturnDetail({ ret }: { ret: SupplierReturnRow }) {
  const boundCapital = ret.lines.reduce((sum, line) => sum + Math.round(Number(line.purchaseLine.unitPriceNet) * 100) * line.quantity, 0);
  return <DetailDrawer title={ret.returnNumber ?? ret.id.slice(0, 8)} description={`${ret.purchase.purchaseNumber} · ${ret.supplierSnapshot}`}>
    <DetailSection title="Relation"><p className="font-mono text-xs">{ret.returnNumber ?? "LR-…"} → {ret.purchase.purchaseNumber} → {ret.lines.map((line) => line.inventoryPosition.inventoryNumber).join(" · ")}</p></DetailSection>
    <DetailSection title="Rückgabe"><DetailGrid items={[
      { label: "RMA", value: ret.rmaNumber ?? "–" }, { label: "Frist", value: ret.returnDeadline?.toLocaleDateString("de-DE") ?? "–" },
      { label: "Versendet", value: ret.dispatchedAt?.toLocaleDateString("de-DE") ?? "–" }, { label: "Angekommen", value: ret.arrivedAt?.toLocaleDateString("de-DE") ?? "–" },
      { label: "Tracking", value: ret.trackingNumber ?? "–" }, { label: "Status", value: STATUS_LABELS[ret.status] },
    ]} /></DetailSection>
    <DetailSection title="Positionen & Bewegungen">
      {ret.lines.map((line) => <p key={line.id} className="font-mono text-xs">
        {line.inventoryPosition.inventoryNumber} · {line.quantity} × {bucketLabel(line.sourceBucket)} · Movement {line.outboundMovement?.id ?? "noch nicht gebucht"}
      </p>)}
    </DetailSection>
    <DetailSection title="Finanzen"><DetailGrid items={[
      { label: "Gebundenes Kapital", value: formatEuro(boundCapital) }, { label: "Versandkosten", value: formatEuro(ret.shippingCostCents) },
      { label: "Erwartete Erstattung", value: formatEuro(ret.expectedRefundCents) }, { label: "Tatsächliche Erstattung", value: formatEuro(ret.actualRefundCents) },
    ]} /></DetailSection>
    {(ret.documentUrls.length > 0 || ret.evidenceUrls.length > 0) && <DetailSection title="Dokumente & Nachweise">
      <div className="space-y-1">
        {[...ret.documentUrls, ...ret.evidenceUrls].map((url) => <a key={url} className="block break-all text-sm underline underline-offset-2" href={url} target="_blank" rel="noreferrer">{url}</a>)}
      </div>
    </DetailSection>}
    {ret.notes && <DetailSection title="Notizen"><p>{ret.notes}</p></DetailSection>}
  </DetailDrawer>;
}

function bucketLabel(bucket: string) {
  return { AVAILABLE: "Verfügbar", RESERVED: "Reserviert", INSPECTION: "Prüfung", DEFECTIVE: "Defekt" }[bucket] ?? bucket;
}
