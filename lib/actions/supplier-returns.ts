"use server";

import { revalidatePath } from "next/cache";
import { InventoryBucket, ItemCondition, SupplierReturnStatus } from "@prisma/client";
import { z } from "zod";
import type { ActionState } from "@/lib/actions/team";
import { euroToCents } from "@/lib/calculations";
import { requireOrg } from "@/lib/org";
import { parseHttpUrlList } from "@/lib/url-list";
import {
  ACTIVE_SUPPLIER_RETURN_PLAN_STATUSES,
  calculateSupplierReturnableQuantity,
  createSupplierReturn,
  dispatchSupplierReturn,
  recordSupplierReturnRefund,
  SupplierReturnDomainError,
  transitionSupplierReturn,
} from "@/lib/services/supplier-return-service";

const optionalEuro = z
  .string()
  .transform((value, context) => {
    if (!value.trim()) return 0;
    try {
      return euroToCents(value);
    } catch {
      context.addIssue({ code: "custom", message: "Ungültiger Betrag." });
      return z.NEVER;
    }
  });

const optionalDate = z.string().refine(
  (value) => !value || !Number.isNaN(new Date(value).getTime()),
  "Ungültiges Datum."
);

const createSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  purchaseId: z.string().min(1, "Bitte einen Einkauf wählen."),
  requestedAt: z.coerce.date(),
  returnDeadline: optionalDate,
  rmaNumber: z.string().max(200).optional(),
  expectedRefund: optionalEuro,
  shippingCost: optionalEuro,
  notes: z.string().max(3000).optional(),
  documentUrls: z.string().max(5000).optional(),
  evidenceUrls: z.string().max(5000).optional(),
  purchaseLineIds: z.array(z.string().min(1)).min(1),
  inventoryPositionIds: z.array(z.string().min(1)).min(1),
  sourceBuckets: z.array(z.nativeEnum(InventoryBucket)),
  quantities: z.array(z.coerce.number().int().min(1)),
  reasons: z.array(z.string().trim().min(1, "Rückgabegrund fehlt.").max(500)),
  itemConditions: z.array(z.nativeEnum(ItemCondition).optional()),
});

export async function createSupplierReturnAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  const parsed = createSchema.safeParse({
    idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
    purchaseId: formData.get("purchaseId"),
    requestedAt: formData.get("requestedAt") || new Date(),
    returnDeadline: String(formData.get("returnDeadline") ?? ""),
    rmaNumber: String(formData.get("rmaNumber") ?? ""),
    expectedRefund: String(formData.get("expectedRefund") ?? ""),
    shippingCost: String(formData.get("shippingCost") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    documentUrls: String(formData.get("documentUrls") ?? ""),
    evidenceUrls: String(formData.get("evidenceUrls") ?? ""),
    purchaseLineIds: formData.getAll("purchaseLineIds").map(String),
    inventoryPositionIds: formData.getAll("inventoryPositionIds").map(String),
    sourceBuckets: formData.getAll("sourceBuckets").map(String),
    quantities: formData.getAll("quantities").map(String),
    reasons: formData.getAll("reasons").map(String),
    itemConditions: formData.getAll("itemConditions").map((value) =>
      String(value) || undefined
    ),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;
  const count = data.purchaseLineIds.length;
  if (
    data.inventoryPositionIds.length !== count ||
    data.sourceBuckets.length !== count ||
    data.quantities.length !== count ||
    data.reasons.length !== count ||
    data.itemConditions.length !== count
  ) {
    return { error: "Die ausgewählten Retourenpositionen sind unvollständig." };
  }

  try {
    const supplierReturn = await createSupplierReturn({
      organizationId: organization.id,
      createdById: userId,
      purchaseId: data.purchaseId,
      idempotencyKey: data.idempotencyKey,
      requestedAt: data.requestedAt,
      returnDeadline: data.returnDeadline ? new Date(data.returnDeadline) : null,
      rmaNumber: data.rmaNumber || null,
      expectedRefundCents: data.expectedRefund,
      shippingCostCents: data.shippingCost,
      notes: data.notes || null,
      documentUrls: parseHttpUrlList(data.documentUrls),
      evidenceUrls: parseHttpUrlList(data.evidenceUrls),
      selections: data.purchaseLineIds.map((purchaseLineId, index) => ({
        purchaseLineId,
        inventoryPositionId: data.inventoryPositionIds[index],
        sourceBucket: data.sourceBuckets[index],
        quantity: data.quantities[index],
        reason: data.reasons[index] || null,
        itemCondition: data.itemConditions[index] ?? null,
      })),
    });
    revalidateSupplierReturnViews();
    return { success: `Lieferantenretoure ${supplierReturn.returnNumber ?? ""} geplant.` };
  } catch (error) {
    return { error: supplierReturnErrorMessage(error) };
  }
}

function supplierReturnErrorMessage(error: unknown): string {
  if (error instanceof SupplierReturnDomainError) return error.message;
  if (error instanceof Error && (
    error.message.startsWith("UngÃ¼ltige URL:")
    || error.message.startsWith("Nur HTTP-/HTTPS-URLs sind erlaubt:")
  )) return error.message;
  return "Lieferantenretoure konnte nicht erstellt werden.";
}

const stockSupplierReturnSchema = z.object({
  mode: z.enum(["FULL", "PARTIAL"]),
  quantity: z.coerce.number().int("Menge muss eine ganze Zahl sein.").min(1, "Menge muss mindestens 1 sein."),
  reason: z.string().trim().min(1, "Rückgabegrund fehlt.").max(500),
  idempotencyKey: z.string().uuid("Die Anfrage ist ungültig. Bitte Dialog erneut öffnen."),
});

export type StockSupplierReturnActionState = {
  error?: string;
  success?: string;
  redirectTo?: string;
} | null;

export async function createSupplierReturnFromStockAction(
  inventoryPositionId: string,
  _previous: StockSupplierReturnActionState,
  formData: FormData
): Promise<StockSupplierReturnActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  const parsed = stockSupplierReturnSchema.safeParse({
    mode: formData.get("mode"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Retourenmenge." };
  }

  const existing = await db.supplierReturn.findFirst({
    where: {
      organizationId: organization.id,
      idempotencyKey: parsed.data.idempotencyKey,
    },
    select: {
      id: true,
      returnNumber: true,
      lines: {
        where: { inventoryPositionId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (existing) {
    if (existing.lines.length === 0) {
      return { error: "Diese Anfrage wurde bereits fÃ¼r eine andere Lagerposition verwendet. Bitte Dialog erneut Ã¶ffnen." };
    }
    return {
      success: `Lieferantenretoure ${existing.returnNumber ?? existing.id} ist bereits geplant. Der Bestand bleibt bis zum Versand unverÃ¤ndert.`,
      redirectTo: `/retouren/lieferanten?q=${encodeURIComponent(existing.returnNumber ?? existing.id)}`,
    };
  }

  const position = await db.inventoryPosition.findFirst({
    where: { id: inventoryPositionId, organizationId: organization.id },
    select: {
      id: true,
      inventoryType: true,
      itemCondition: true,
      quantityAvailable: true,
      ownedLot: {
        select: {
          purchaseLine: {
            select: { id: true, purchase: { select: { id: true } } },
          },
        },
      },
      supplierReturnLines: {
        where: {
          outboundMovementId: null,
          supplierReturn: { status: { in: ACTIVE_SUPPLIER_RETURN_PLAN_STATUSES } },
        },
        select: { quantity: true, sourceBucket: true },
      },
    },
  });
  if (!position) return { error: "Lagerposition wurde nicht gefunden." };
  if (position.inventoryType !== "OWNED") {
    return { error: "Lieferantenretouren können nur aus Eigenbestand erstellt werden." };
  }
  const purchaseLine = position.ownedLot?.purchaseLine;
  if (!purchaseLine) {
    return {
      error: "Für diese historische Lagerposition ist kein Einkauf verknüpft.",
    };
  }

  const returnableQuantity = calculateSupplierReturnableQuantity(
    position.quantityAvailable,
    position.supplierReturnLines
  );
  const quantity = parsed.data.mode === "FULL"
    ? returnableQuantity
    : parsed.data.quantity;
  if (quantity < 1 || quantity > returnableQuantity) {
    return {
      error: `Menge muss zwischen 1 und ${returnableQuantity} Stück liegen.`,
    };
  }

  try {
    const supplierReturn = await createSupplierReturn({
      organizationId: organization.id,
      createdById: userId,
      purchaseId: purchaseLine.purchase.id,
      idempotencyKey: parsed.data.idempotencyKey,
      requestedAt: new Date(),
      selections: [{
        purchaseLineId: purchaseLine.id,
        inventoryPositionId: position.id,
        sourceBucket: "AVAILABLE",
        quantity,
        reason: parsed.data.reason,
        itemCondition: position.itemCondition ?? null,
      }],
    });
    revalidateSupplierReturnViews();
    return {
      success: `Lieferantenretoure ${supplierReturn.returnNumber ?? ""} geplant. Der Bestand bleibt bis zum Versand unverändert.`,
      redirectTo: `/retouren/lieferanten?q=${encodeURIComponent(supplierReturn.returnNumber ?? supplierReturn.id)}`,
    };
  } catch (error) {
    return {
      error: supplierReturnErrorMessage(error),
    };
  }
}

export async function updateSupplierReturnStatusAction(
  supplierReturnId: string,
  nextStatus: SupplierReturnStatus,
  rejectionReason?: string
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  const parsed = z.object({
    supplierReturnId: z.string().min(1),
    nextStatus: z.nativeEnum(SupplierReturnStatus),
    rejectionReason: z.string().max(2000).optional(),
  }).safeParse({ supplierReturnId, nextStatus, rejectionReason });
  if (!parsed.success || parsed.data.nextStatus === "DISPATCHED") {
    return { error: "Ungültiger oder bewegungsrelevanter Status." };
  }
  try {
    const updated = await transitionSupplierReturn({
      organizationId: organization.id,
      supplierReturnId: parsed.data.supplierReturnId,
      nextStatus: parsed.data.nextStatus,
      rejectionReason: parsed.data.rejectionReason,
      createdById: userId,
    });
    revalidateSupplierReturnViews();
    return { success: `${updated.returnNumber ?? "Lieferantenretoure"}: Status aktualisiert.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Status konnte nicht geändert werden." };
  }
}

export async function dispatchSupplierReturnAction(
  supplierReturnId: string,
  carrier?: string,
  trackingNumber?: string
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  const parsed = z.object({
    supplierReturnId: z.string().min(1),
    carrier: z.string().max(100).optional(),
    trackingNumber: z.string().max(200).optional(),
  }).safeParse({ supplierReturnId, carrier, trackingNumber });
  if (!parsed.success) return { error: "Ungültige Versanddaten." };
  try {
    const updated = await dispatchSupplierReturn({
      organizationId: organization.id,
      supplierReturnId: parsed.data.supplierReturnId,
      createdById: userId,
      carrier: parsed.data.carrier || null,
      trackingNumber: parsed.data.trackingNumber || null,
    });
    revalidateSupplierReturnViews();
    return { success: `${updated.returnNumber ?? "Lieferantenretoure"} versendet und Bestand gebucht.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Versand konnte nicht gebucht werden." };
  }
}

export async function recordSupplierReturnRefundAction(
  supplierReturnId: string,
  amount: string,
  creditReference?: string
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  const parsed = z.object({
    supplierReturnId: z.string().min(1),
    amount: z.string().max(100),
    creditReference: z.string().max(200).optional(),
  }).safeParse({ supplierReturnId, amount, creditReference });
  if (!parsed.success) return { error: "Ungültige Erstattungsdaten." };
  let actualRefundCents: number;
  try {
    actualRefundCents = euroToCents(parsed.data.amount || "0");
  } catch {
    return { error: "Ungültiger Erstattungsbetrag." };
  }
  try {
    const updated = await recordSupplierReturnRefund({
      organizationId: organization.id,
      supplierReturnId: parsed.data.supplierReturnId,
      actualRefundCents,
      creditReference: parsed.data.creditReference || null,
      createdById: userId,
    });
    revalidateSupplierReturnViews();
    return { success: `${updated.returnNumber ?? "Lieferantenretoure"}: Erstattung gespeichert.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erstattung konnte nicht gespeichert werden." };
  }
}

function revalidateSupplierReturnViews(): void {
  revalidatePath("/retouren/lieferanten");
  revalidatePath("/einkauf");
  revalidatePath("/lager");
  revalidatePath("/dashboard");
}
