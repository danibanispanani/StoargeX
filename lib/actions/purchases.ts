"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { euroToCents } from "@/lib/calculations";
import {
  createPurchaseOrder,
  receivePurchase,
  type OwnedPurchaseLineInput,
  type ReceivePurchaseLineInput,
} from "@/lib/services/owned-purchase-service";

export interface PurchaseActionState {
  success?: string;
  error?: string;
}

const condition = z.enum(["NEW", "OPEN_BOX", "REFURBISHED", "USED", "DEFECTIVE"]);
const inspection = z.enum(["PENDING", "PASSED", "DEFECTIVE"]);

const orderLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().int().min(1).max(100000),
  unitPriceGross: z.string().min(1),
  inputTaxDeductible: z.boolean().default(false),
  inputTaxRatePercent: z.coerce.number().min(0).max(100).default(19),
  itemCondition: condition.optional(),
  comment: z.string().max(1000).optional(),
});

const orderSchema = z.object({
  vendor: z.string().trim().max(300).default(""),
  businessPartnerId: z.string().optional(),
  paymentMethod: z.string().trim().min(1).max(200),
  paymentAccountId: z.string().optional(),
  purchaseDate: z.coerce.date(),
  expectedDeliveryAt: z.coerce.date().optional(),
  supplierOrderNumber: z.string().max(200).optional(),
  shippingCarrier: z.string().max(200).optional(),
  trackingNumber: z.string().max(300).optional(),
  documentReference: z.string().max(500).optional(),
  comment: z.string().max(2000).optional(),
  lines: z.array(orderLineSchema).min(1).max(100),
}).refine((data) => Boolean(data.vendor || data.businessPartnerId), {
  message: "Lieferant aus Stamm oder als Freitext ist erforderlich.",
  path: ["vendor"],
});

const receiptLineSchema = z.object({
  purchaseLineId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100000),
  itemCondition: condition.optional(),
  legacyCondition: z.string().max(200).optional(),
  inspectionStatus: inspection.default("PASSED"),
  returnDeadline: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

const receiptSchema = z.object({
  purchaseId: z.string().min(1),
  receivedAt: z.coerce.date(),
  returnWindowDays: z.coerce.number().int().min(0).max(3650).optional(),
  returnDeadline: z.coerce.date().optional(),
  shippingCarrier: z.string().max(200).optional(),
  trackingNumber: z.string().max(300).optional(),
  documentReference: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(receiptLineSchema).min(1).max(100),
});

export async function createPurchaseOrderAction(
  _previous: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  try {
    const rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
    const data = orderSchema.parse({
      vendor: formData.get("vendor"),
      businessPartnerId: optional(formData.get("businessPartnerId")),
      paymentMethod: formData.get("paymentMethod"),
      paymentAccountId: optional(formData.get("paymentAccountId")),
      purchaseDate: formData.get("purchaseDate"),
      expectedDeliveryAt: optional(formData.get("expectedDeliveryAt")),
      supplierOrderNumber: optional(formData.get("supplierOrderNumber")),
      shippingCarrier: optional(formData.get("shippingCarrier")),
      trackingNumber: optional(formData.get("trackingNumber")),
      documentReference: optional(formData.get("documentReference")),
      comment: optional(formData.get("comment")),
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
      comment: line.comment,
    }));
    const selectedSupplier = data.businessPartnerId
      ? await db.businessPartner.findFirst({
          where: { id: data.businessPartnerId, active: true, roles: { some: { role: "SUPPLIER" } } },
          select: { displayName: true },
        })
      : null;
    const vendor = selectedSupplier?.displayName ?? data.vendor;
    const result = await createPurchaseOrder({
      organizationId: organization.id,
      createdById: userId,
      ...data,
      vendor,
      businessPartnerId: data.businessPartnerId || undefined,
      paymentAccountId: data.paymentAccountId || undefined,
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
      returnWindowDays: optional(formData.get("returnWindowDays")),
      returnDeadline: optional(formData.get("returnDeadline")),
      shippingCarrier: optional(formData.get("shippingCarrier")),
      trackingNumber: optional(formData.get("trackingNumber")),
      documentReference: optional(formData.get("documentReference")),
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

function actionError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}
