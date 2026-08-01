import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { PageHeader } from "@/components/app/page-header";
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
  const optionsPromise = Promise.all([
    db.businessPartner.findMany({
      where: { active: true, roles: { some: { role: "SUPPLIER" } } },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    db.product.findMany({
      select: { id: true, name: true, variant: true, imageUrls: true }, orderBy: { name: "asc" }, take: 1000,
    }),
    getOptions(db, organization.id, "PAYMENT_METHOD"),
  ]);
  const totalResults = await db.purchase.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalResults / requested.pageSize));
  const query = { ...requested, page: Math.min(requested.page, totalPages) };
  const [purchases, [suppliers, products, paymentMethods]] = await Promise.all([
    db.purchase.findMany({
      where,
      orderBy: buildPurchaseOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        businessPartner: { select: { displayName: true } },
        debtLinks: { select: { id: true } },
        lines: {
          include: {
            product: { select: { name: true, variant: true, defaultCondition: true, imageUrls: true } },
            receiptLines: {
              include: {
                purchaseReceipt: { select: { id: true, cancelledAt: true, receivedAt: true } },
                inventoryPosition: { select: { inventoryNumber: true, receivedAt: true } },
                inboundMovement: { select: { id: true } },
              },
            },
            ownedLots: {
              select: {
                inventoryPositionId: true,
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
    optionsPromise,
  ]);

  const rows: PurchaseOperationalRow[] = purchases.map((purchase) => {
    const receipts = new Map<string, PurchaseOperationalRow["receipts"][number]>();
    for (const line of purchase.lines) {
      const product = [line.product.name, line.product.variant].filter(Boolean).join(" · ");
      for (const receiptLine of line.receiptLines) {
        const receipt = receipts.get(receiptLine.purchaseReceipt.id) ?? {
          id: receiptLine.purchaseReceipt.id,
          receivedAt: receiptLine.purchaseReceipt.receivedAt.toISOString(),
          cancelledAt: receiptLine.purchaseReceipt.cancelledAt?.toISOString() ?? null,
          lines: [],
        };
        receipt.lines.push({ product, quantity: receiptLine.quantity });
        receipts.set(receipt.id, receipt);
      }
    }
    return {
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
    paymentMethod: purchase.paymentMethod,
    comment: purchase.comment ?? "",
    debtCount: purchase.debtLinks.length,
    lines: purchase.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: [line.product.name, line.product.variant].filter(Boolean).join(" · "),
      imageUrl: line.product.imageUrls[0] ?? null,
      condition: line.product.defaultCondition,
      quantity: line.quantity,
      received: effectiveReceivedQuantity({
        receiptQuantities: line.receiptLines.map((receipt) =>
          receipt.purchaseReceipt.cancelledAt ? 0 : receipt.quantity
        ),
        legacyLotQuantities: line.ownedLots.map((lot) => lot.inventoryPosition.quantityReceived),
        receiptInventoryPositionIds: line.receiptLines.map((receipt) => receipt.inventoryPositionId),
        legacyLots: line.ownedLots.map((lot) => ({
          inventoryPositionId: lot.inventoryPositionId,
          quantity: lot.inventoryPosition.quantityReceived,
        })),
      }),
      grossCents: decimalToCents(line.totalGross),
      unitGrossCents: decimalToCents(line.unitPriceGross),
      netCents: decimalToCents(line.totalNet),
    })),
    receipts: [...receipts.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    lots: purchase.lines.flatMap((line) => {
      const receiptPositionIds = new Set(line.receiptLines.map((receipt) => receipt.inventoryPositionId));
      return [
        ...line.receiptLines.map((receipt) => ({
          inventoryNumber: receipt.inventoryPosition.inventoryNumber,
          quantity: receipt.quantity,
          receivedAt: receipt.inventoryPosition.receivedAt.toISOString(),
          movementId: receipt.inboundMovement.id,
          cancelled: Boolean(receipt.purchaseReceipt.cancelledAt),
        })),
        ...line.ownedLots.filter((lot) => !receiptPositionIds.has(lot.inventoryPositionId)).map((lot) => ({
          inventoryNumber: lot.inventoryPosition.inventoryNumber,
          quantity: lot.inventoryPosition.quantityReceived,
          receivedAt: lot.inventoryPosition.receivedAt.toISOString(),
          movementId: lot.inventoryPosition.movements[0]?.id ?? "Legacy",
          cancelled: false,
        })),
      ];
    }),
    };
  });
  const supplierOptions = suppliers.map((item) => ({ id: item.id, label: item.displayName }));

  return <div className="space-y-4">
    <PageHeader
      eyebrow="Handel / Beschaffung"
      title="Einkauf"
      description="Bestellungen vom Einkauf über den Versand bis zum Wareneingang steuern."
      actions={<PurchaseOrderDialog suppliers={supplierOptions} paymentMethods={paymentMethods} products={products.map((item) => ({ id: item.id, name: item.name, imageUrl: item.imageUrls[0] ?? "", label: [item.name, item.variant].filter(Boolean).join(" · ") }))} />}
    />
    <PurchaseFilterBar query={query} suppliers={supplierOptions} />
    <PurchaseTable rows={rows} totalResults={totalResults} query={query} queryString={purchaseQueryToSearchParams(query).toString()} scope={{ organizationId: organization.id, userId, tableKey: "purchases" }} nowIso={new Date().toISOString()} suppliers={supplierOptions} paymentMethods={paymentMethods} />
  </div>;
}

function decimalToCents(value: { toString(): string }) { return Math.round(Number(value.toString()) * 100); }
