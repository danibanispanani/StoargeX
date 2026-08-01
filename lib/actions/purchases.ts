"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ItemCondition } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { euroToCents } from "@/lib/calculations";
import { writeAuditLog } from "@/lib/audit";
import { httpImageUrlSchema } from "@/lib/validation/http-image-url";
import {
  PURCHASE_SHIPPING_STATUS_VALUES,
  PURCHASE_STATUS_VALUES,
  RETURN_WINDOW_DAYS,
} from "@/lib/purchases/purchase-workflow";
import {
  cancelPurchase,
  cancelPurchaseReceipt,
  createPurchaseOrder,
  receivePurchase,
  updatePurchase,
  updatePurchaseWorkflowStatus,
  type OwnedPurchaseLineInput,
  type ReceivePurchaseLineInput,
} from "@/lib/services/owned-purchase-service";

export interface PurchaseActionState {
  success?: string;
  error?: string;
}

const condition = z.nativeEnum(ItemCondition);
const requiredDate = z.string().trim().min(1, "Datum ist erforderlich.").pipe(z.coerce.date());
const orderLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().int().min(1).max(100000),
  unitPriceGross: z.string().min(1),
  inputTaxDeductible: z.boolean().default(false),
  inputTaxRatePercent: z.coerce.number().min(0).max(100).default(19),
  itemCondition: condition.optional(),
  imageUrl: httpImageUrlSchema.optional(),
  comment: z.string().max(1000).optional(),
});

const purchaseMetadataSchema = z.object({
  vendor: z.string().trim().min(1, "Lieferant ist erforderlich.").max(300),
  saveSupplier: z.boolean().default(false),
  paymentMethod: z.string().trim().min(1).max(200),
  purchaseDate: requiredDate,
  expectedDeliveryAt: z.coerce.date().optional(),
  supplierOrderNumber: z.string().max(200).optional(),
  shippingCarrier: z.string().max(200).optional(),
  trackingNumber: z.string().max(300).optional(),
  comment: z.string().max(2000).optional(),
});

const orderSchema = purchaseMetadataSchema.extend({
  lines: z.array(orderLineSchema).min(1).max(100),
});

const receiptLineSchema = z.object({
  purchaseLineId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100000),
  itemCondition: condition.optional(),
  legacyCondition: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

const receiptSchema = z.object({
  purchaseId: z.string().min(1),
  receivedAt: requiredDate,
  returnWindowDays: z.coerce.number().pipe(
    z.union(RETURN_WINDOW_DAYS.map((days) => z.literal(days)) as [z.ZodLiteral<14>, z.ZodLiteral<30>])
  ),
  notes: z.string().max(2000).optional(),
  lines: z.array(receiptLineSchema).min(1).max(100),
});

const updateSchema = purchaseMetadataSchema.extend({
  purchaseId: z.string().min(1),
  purchaseStatus: z.enum(PURCHASE_STATUS_VALUES),
  shippingStatus: z.enum(PURCHASE_SHIPPING_STATUS_VALUES),
});

const supplierNameSchema = z.string().trim().min(1, "Lieferantenname ist erforderlich.").max(300);

export async function createPurchaseOrderAction(
  _previous: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
    const data = orderSchema.parse({
      ...purchaseMetadataFromForm(formData),
      lines: rawLines,
    });
    const lines: OwnedPurchaseLineInput[] = data.lines.map((line) => ({
      productId: line.productId || undefined,
      productName: line.productName,
      quantity: line.quantity,
      unitPriceGrossCents: euroToCents(line.unitPriceGross),
      inputTaxDeductible: line.inputTaxDeductible,
      inputTaxRatePercent: line.inputTaxRatePercent,
      purchaseEntryStatus: "O",
      returnEntryStatus: "NN",
      itemCondition: line.itemCondition,
      imageUrls: line.imageUrl ? [line.imageUrl] : [],
      comment: line.comment,
    }));
    const result = await createPurchaseOrder({
      organizationId: organization.id,
      createdById: userId,
      ...data,
      lines,
    });
    revalidatePurchasing();
    return { success: `Einkauf ${result.purchaseNumber} mit ${result.lines.length} Position(en) angelegt.` };
  } catch (error) {
    return { error: actionError(error, "Einkauf konnte nicht angelegt werden.") };
  }
}

export async function receivePurchaseAction(
  _previous: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const data = receiptSchema.parse({
      purchaseId: formData.get("purchaseId"),
      receivedAt: formData.get("receivedAt"),
      returnWindowDays: formData.get("returnWindowDays"),
      notes: optional(formData.get("notes")),
      lines: JSON.parse(String(formData.get("lines") ?? "[]")),
    });
    const lines: ReceivePurchaseLineInput[] = data.lines;
    const result = await receivePurchase({
      organizationId: organization.id,
      createdById: userId,
      ...data,
      lines,
    });
    revalidatePurchasing();
    return {
      success: `${result.complete ? "Vollständiger" : "Teil-"}Wareneingang mit ${result.lines.length} Charge(n) gebucht.`,
    };
  } catch (error) {
    return { error: actionError(error, "Wareneingang konnte nicht gebucht werden.") };
  }
}

export async function updatePurchaseStatusAction(
  purchaseId: string,
  status: string
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const purchaseStatus = z.enum(PURCHASE_STATUS_VALUES).parse(status);
    await updatePurchaseWorkflowStatus({
      organizationId: organization.id,
      createdById: userId,
      purchaseId,
      purchaseStatus,
    });
    revalidatePath("/einkauf");
    return { success: "Bestellstatus aktualisiert." };
  } catch (error) {
    return { error: actionError(error, "Bestellstatus konnte nicht aktualisiert werden.") };
  }
}

export async function updatePurchaseShippingStatusAction(
  purchaseId: string,
  status: string
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const shippingStatus = z.enum(PURCHASE_SHIPPING_STATUS_VALUES).parse(status);
    await updatePurchaseWorkflowStatus({
      organizationId: organization.id,
      createdById: userId,
      purchaseId,
      shippingStatus,
    });
    revalidatePath("/einkauf");
    return { success: "Versandstatus aktualisiert." };
  } catch (error) {
    return { error: actionError(error, "Versandstatus konnte nicht aktualisiert werden.") };
  }
}

export interface PurchaseSupplierActionState extends PurchaseActionState {
  supplier?: { id: string; label: string };
}

export async function createPurchaseSupplierAction(name: string): Promise<PurchaseSupplierActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  try {
    const displayName = supplierNameSchema.parse(name);
    const existing = await db.businessPartner.findFirst({
      where: { organizationId: organization.id, displayName: { equals: displayName, mode: "insensitive" } },
      select: { id: true, displayName: true },
    });
    const supplier = existing
      ? await db.businessPartner.update({
          where: { id: existing.id },
          data: {
            active: true,
            roles: {
              upsert: {
                where: { businessPartnerId_role: { businessPartnerId: existing.id, role: "SUPPLIER" } },
                create: { organizationId: organization.id, role: "SUPPLIER" },
                update: {},
              },
            },
          },
          select: { id: true, displayName: true },
        })
      : await db.businessPartner.create({
          data: {
            organizationId: organization.id,
            displayName,
            roles: { create: { organizationId: organization.id, role: "SUPPLIER" } },
          },
          select: { id: true, displayName: true },
        });
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "supplier.create",
      entityType: "BusinessPartner",
      entityId: supplier.id,
      after: { displayName: supplier.displayName },
    });
    revalidatePath("/einkauf");
    return { success: "Lieferant gespeichert.", supplier: { id: supplier.id, label: supplier.displayName } };
  } catch (error) {
    return { error: actionError(error, "Lieferant konnte nicht gespeichert werden.") };
  }
}

export async function renamePurchaseSupplierAction(
  supplierId: string,
  name: string
): Promise<PurchaseSupplierActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  try {
    const displayName = supplierNameSchema.parse(name);
    const existing = await db.businessPartner.findFirst({
      where: {
        id: supplierId,
        organizationId: organization.id,
        roles: { some: { role: "SUPPLIER" } },
      },
      select: { id: true, displayName: true },
    });
    if (!existing) throw new Error("Lieferant wurde nicht gefunden.");
    const supplier = await db.businessPartner.update({
      where: { id: existing.id },
      data: { displayName },
      select: { id: true, displayName: true },
    });
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "supplier.update",
      entityType: "BusinessPartner",
      entityId: supplier.id,
      before: { displayName: existing.displayName },
      after: { displayName: supplier.displayName },
    });
    revalidatePath("/einkauf");
    return { success: "Lieferant aktualisiert.", supplier: { id: supplier.id, label: supplier.displayName } };
  } catch (error) {
    return { error: actionError(error, "Lieferant konnte nicht aktualisiert werden.") };
  }
}

export async function deletePurchaseSupplierAction(supplierId: string): Promise<PurchaseSupplierActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  try {
    const existing = await db.businessPartner.findFirst({
      where: {
        id: supplierId,
        organizationId: organization.id,
        roles: { some: { role: "SUPPLIER" } },
      },
      select: { id: true, displayName: true },
    });
    if (!existing) throw new Error("Lieferant wurde nicht gefunden.");
    await db.businessPartnerRole.deleteMany({
      where: { organizationId: organization.id, businessPartnerId: existing.id, role: "SUPPLIER" },
    });
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "supplier.remove_role",
      entityType: "BusinessPartner",
      entityId: existing.id,
      before: { displayName: existing.displayName, role: "SUPPLIER" },
    });
    revalidatePath("/einkauf");
    return { success: "Lieferant aus der Auswahl entfernt." };
  } catch (error) {
    return { error: actionError(error, "Lieferant konnte nicht entfernt werden.") };
  }
}

export async function updatePurchaseAction(
  _previous: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const data = updateSchema.parse({
      ...purchaseMetadataFromForm(formData),
      purchaseId: formData.get("purchaseId"),
      purchaseStatus: formData.get("purchaseStatus"),
      shippingStatus: formData.get("shippingStatus"),
    });
    await updatePurchase({
      organizationId: organization.id,
      createdById: userId,
      ...data,
    });
    revalidatePurchasing();
    return { success: "Einkauf wurde aktualisiert." };
  } catch (error) {
    return { error: actionError(error, "Einkauf konnte nicht aktualisiert werden.") };
  }
}

export async function cancelPurchaseReceiptAction(
  purchaseReceiptId: string
): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const result = await cancelPurchaseReceipt({
      organizationId: organization.id,
      createdById: userId,
      purchaseReceiptId,
    });
    revalidatePurchasing();
    return {
      success: result.alreadyCancelled
        ? "Wareneingang war bereits storniert."
        : "Wareneingang storniert; die Menge ist wieder offen.",
    };
  } catch (error) {
    return { error: actionError(error, "Wareneingang konnte nicht storniert werden.") };
  }
}

export async function cancelPurchaseAction(purchaseId: string): Promise<PurchaseActionState> {
  const { organization, userId } = await requireOrg("MEMBER");
  try {
    const result = await cancelPurchase({
      organizationId: organization.id,
      createdById: userId,
      purchaseId,
    });
    revalidatePurchasing();
    return {
      success: result.alreadyCancelled
        ? "Bestellung war bereits storniert."
        : "Bestellung und vorhandene Wareneingänge wurden storniert.",
    };
  } catch (error) {
    return { error: actionError(error, "Bestellung konnte nicht storniert werden.") };
  }
}

function revalidatePurchasing() {
  revalidatePath("/einkauf");
  revalidatePath("/lager");
  revalidatePath("/dashboard");
  revalidatePath("/schulden");
}

function optional(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function purchaseMetadataFromForm(formData: FormData) {
  return {
    vendor: formData.get("vendor"),
    saveSupplier: formData.get("saveSupplier") === "on",
    paymentMethod: formData.get("paymentMethod"),
    purchaseDate: formData.get("purchaseDate"),
    expectedDeliveryAt: optional(formData.get("expectedDeliveryAt")),
    supplierOrderNumber: optional(formData.get("supplierOrderNumber")),
    shippingCarrier: optional(formData.get("shippingCarrier")),
    trackingNumber: optional(formData.get("trackingNumber")),
    comment: optional(formData.get("comment")),
  };
}

function actionError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}
