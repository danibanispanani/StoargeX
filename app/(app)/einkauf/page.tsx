import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { PageHeader } from "@/components/app/page-header";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { PurchaseOrderDialog } from "@/components/purchases/purchase-dialogs";
import { PurchaseFilterBar } from "@/components/purchases/purchase-filter-bar";
import { PurchaseTable, type PurchaseOperationalRow } from "@/components/purchases/purchase-table";
import {
  buildPurchaseOrderBy,
  buildPurchaseWhere,
  parsePurchaseTableQuery,
  purchaseQueryToSearchParams,
} from "@/lib/purchases/purchase-table";
import { effectiveReceivedQuantity } from "@/lib/services/owned-purchase-service";

type Params = Record<string, string | string[] | undefined>;

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { db, organization, userId } = await requireOrg();
  const requested = parsePurchaseTableQuery(await searchParams);
  const where = buildPurchaseWhere(requested);
  const totalResults = await db.purchase.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalResults / requested.pageSize));
  const query = { ...requested, page: Math.min(requested.page, totalPages) };
  const [purchases, suppliers, paymentAccounts, products, paymentMethods] = await Promise.all([
    db.purchase.findMany({
      where,
      orderBy: buildPurchaseOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        businessPartner: { select: { displayName: true } },
        paymentAccount: { select: { displayName: true } },
        debtLinks: { select: { id: true } },
        lines: {
          include: {
            product: { select: { name: true, variant: true, defaultCondition: true } },
            receiptLines: {
              include: {
                inventoryPosition: { select: { inventoryNumber: true, receivedAt: true } },
                inboundMovement: { select: { id: true } },
              },
            },
            ownedLots: {
              select: {
                inventoryPosition: {
                  select: {
                    inventoryNumber: true,
                    receivedAt: true,
                    quantityReceived: true,
                    movements: {
                      where: { movementType: "PURCHASE_RECEIPT" },
                      select: { id: true },
                      orderBy: { createdAt: "asc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.businessPartner.findMany({
      where: { active: true, roles: { some: { role: "SUPPLIER" } } },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    db.payoutAccount.findMany({
      where: { active: true }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" },
    }),
    db.product.findMany({
      select: { id: true, name: true, variant: true }, orderBy: { name: "asc" }, take: 1000,
    }),
    getOptions(db, organization.id, "PAYMENT_METHOD"),
  ]);

  const rows: PurchaseOperationalRow[] = purchases.map((purchase) => ({
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseDate: purchase.purchaseDate.toISOString(),
    supplier: purchase.businessPartner?.displayName ?? purchase.vendor,
    supplierOrderNumber: purchase.supplierOrderNumber ?? "",
    status: purchase.purchaseStatus,
    shippingStatus: purchase.shippingStatus,
    shippingCarrier: purchase.shippingCarrier ?? "",
    trackingNumber: purchase.trackingNumber ?? "",
    expectedDeliveryAt: purchase.expectedDeliveryAt?.toISOString() ?? null,
    receivedAt: purchase.receivedAt?.toISOString() ?? null,
    returnDeadline: purchase.returnDeadline?.toISOString() ?? null,
    grossCents: purchase.lines.reduce((sum, line) => sum + decimalToCents(line.totalGross), 0),
    netCents: purchase.lines.reduce((sum, line) => sum + decimalToCents(line.totalNet), 0),
    paymentAccount: purchase.paymentAccount?.displayName ?? "",
    paymentMethod: purchase.paymentMethod,
    documentReference: purchase.documentReference ?? "",
    comment: purchase.comment ?? "",
    debtCount: purchase.debtLinks.length,
    lines: purchase.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: [line.product.name, line.product.variant].filter(Boolean).join(" · "),
      condition: line.product.defaultCondition,
      quantity: line.quantity,
      received: effectiveReceivedQuantity({
        receiptQuantities: line.receiptLines.map((receipt) => receipt.quantity),
        legacyLotQuantities: line.ownedLots.map((lot) => lot.inventoryPosition.quantityReceived),
      }),
      grossCents: decimalToCents(line.totalGross),
      unitGrossCents: decimalToCents(line.unitPriceGross),
      netCents: decimalToCents(line.totalNet),
    })),
    lots: purchase.lines.flatMap((line) => line.receiptLines.length > 0
      ? line.receiptLines.map((receipt) => ({
          inventoryNumber: receipt.inventoryPosition.inventoryNumber,
          quantity: receipt.quantity,
          receivedAt: receipt.inventoryPosition.receivedAt.toISOString(),
          movementId: receipt.inboundMovement.id,
        }))
      : line.ownedLots.map((lot) => ({
          inventoryNumber: lot.inventoryPosition.inventoryNumber,
          quantity: lot.inventoryPosition.quantityReceived,
          receivedAt: lot.inventoryPosition.receivedAt.toISOString(),
          movementId: lot.inventoryPosition.movements[0]?.id ?? "Legacy",
        }))),
  }));
  const supplierOptions = suppliers.map((item) => ({ id: item.id, label: item.displayName }));
  const accountOptions = paymentAccounts.map((item) => ({ id: item.id, label: item.displayName }));

  return <div className="space-y-4">
    <PageHeader
      eyebrow="Handel / Beschaffung"
      title="Einkauf"
      description={`${totalResults} Einkaufsvorgänge · Bestellung, Versand und Wareneingang getrennt nachvollziehbar`}
      actions={<><ImportExportBar table="einkauf" /><PurchaseOrderDialog suppliers={supplierOptions} paymentAccounts={accountOptions} paymentMethods={paymentMethods} products={products.map((item) => ({ id: item.id, name: item.name, label: [item.name, item.variant].filter(Boolean).join(" · ") }))} /></>}
    />
    <PurchaseFilterBar query={query} suppliers={supplierOptions} paymentAccounts={accountOptions} />
    <PurchaseTable rows={rows} totalResults={totalResults} query={query} queryString={purchaseQueryToSearchParams(query).toString()} scope={{ organizationId: organization.id, userId, tableKey: "purchases" }} nowIso={new Date().toISOString()} />
  </div>;
}

function decimalToCents(value: { toString(): string }) { return Math.round(Number(value.toString()) * 100); }
