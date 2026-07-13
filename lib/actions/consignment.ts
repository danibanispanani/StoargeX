"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import {
  FeatureAccessDeniedError,
  requireOrgFeature,
} from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";
import { createConsignmentStock } from "@/lib/services/consignment-service";
import { adjust } from "@/lib/services/inventory-service";

const optionalInt = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().min(0).max(100000).optional()
);

async function getConsignmentMutationContext(minRole: Role = "MEMBER") {
  try {
    return await requireOrgFeature(FEATURE_KEYS.CONSIGNMENT, minRole);
  } catch (error) {
    if (error instanceof FeatureAccessDeniedError) return error;
    throw error;
  }
}

const consignmentSchema = z.object({
  consignorName: z.string().min(1, "Partnerfirma fehlt.").max(200),
  consignorContact: z.string().max(200).optional().or(z.literal("")),
  itemTitle: z.string().min(1, "Artikelbezeichnung fehlt.").max(300),
  brand: z.string().max(120).optional().or(z.literal("")),
  variant: z.string().max(200).optional().or(z.literal("")),
  ean: z.string().max(80).optional().or(z.literal("")),
  identificationNumber: z.string().max(120).optional().or(z.literal("")),
  category: z.string().max(120).optional().or(z.literal("")),
  sku: z.string().max(80).optional().or(z.literal("")),
  quantityReceived: z.coerce.number().int().min(1).max(100000),
  quantityAvailable: optionalInt,
  soldQuantity: optionalInt,
  returnedQuantity: optionalInt,
  defectiveQuantity: optionalInt,
  costGross: z.string().optional().or(z.literal("")),
  costNet: z.string().optional().or(z.literal("")),
  settlementAmount: z.string().optional().or(z.literal("")),
  shippingCost: z.string().optional().or(z.literal("")),
  realRrpGross: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/** Neue Konsignationsartikel über InventoryPosition + ConsignmentLot anlegen. */
export async function createConsignmentItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await getConsignmentMutationContext();
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { organization, userId } = access;

  const parsed = consignmentSchema.safeParse({
    consignorName: formData.get("consignorName"),
    consignorContact: formData.get("consignorContact"),
    itemTitle: formData.get("itemTitle"),
    brand: formData.get("brand"),
    variant: formData.get("variant"),
    ean: formData.get("ean"),
    identificationNumber: formData.get("identificationNumber"),
    category: formData.get("category"),
    sku: formData.get("sku"),
    quantityReceived: formData.get("quantityReceived") ?? formData.get("quantity") ?? 1,
    quantityAvailable: formData.get("quantityAvailable"),
    soldQuantity: formData.get("soldQuantity"),
    returnedQuantity: formData.get("returnedQuantity"),
    defectiveQuantity: formData.get("defectiveQuantity"),
    costGross: formData.get("costGross"),
    costNet: formData.get("costNet"),
    settlementAmount: formData.get("settlementAmount") ?? formData.get("agreedPayout"),
    shippingCost: formData.get("shippingCost"),
    realRrpGross: formData.get("realRrpGross"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const data = parsed.data;

  try {
    const result = await createConsignmentStock({
      organizationId: organization.id,
      createdById: userId,
      partnerCompany: data.consignorName,
      externalSku: data.sku,
      productName: data.itemTitle,
      brand: data.brand,
      variant: data.variant,
      ean: data.ean,
      identificationNumber: data.identificationNumber,
      category: data.category,
      quantityReceived: data.quantityReceived,
      quantityAvailable: data.quantityAvailable,
      quantitySold: data.soldQuantity,
      quantityInspection: data.returnedQuantity,
      quantityDefective: data.defectiveQuantity,
      costGrossCents: parseOptionalMoney(data.costGross, "EK brutto"),
      costNetCents: parseOptionalMoney(data.costNet, "EK netto"),
      settlementAmountCents: parseOptionalMoney(data.settlementAmount, "Endbetrag"),
      shippingCostCents: parseOptionalMoney(data.shippingCost, "Versand"),
      realRrpGrossCents: parseOptionalMoney(data.realRrpGross, "Reale OVP"),
      comment:
        [data.consignorContact, data.notes].filter(Boolean).join(" · ") ||
        undefined,
    });

    revalidatePath("/konsignation");
    return { success: `Konsignationsartikel ${result.inventoryNumber} angelegt.` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Konsignationsartikel konnte nicht angelegt werden.",
    };
  }
}

const countsSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(100000),
  soldQuantity: z.coerce.number().int().min(0).max(100000),
  returnedQuantity: z.coerce.number().int().min(0).max(100000),
  defectiveQuantity: z.coerce.number().int().min(0).max(100000),
});

/** Legacy-Bestandszähler nur für bestehende ConsignmentInventory-Zeilen. */
export async function updateConsignmentCountsAction(
  consignmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await getConsignmentMutationContext();
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { db, organization, userId } = access;

  const parsed = countsSchema.safeParse({
    quantity: formData.get("quantity"),
    soldQuantity: formData.get("soldQuantity"),
    returnedQuantity: formData.get("returnedQuantity"),
    defectiveQuantity: formData.get("defectiveQuantity"),
  });
  if (!parsed.success) {
    return { error: "Ungültige Bestandswerte (ganze Zahlen ≥ 0)." };
  }

  const existing = await db.consignmentInventory.findFirst({
    where: { id: consignmentId },
  });
  if (!existing) return { error: "Legacy-Konsignationsartikel nicht gefunden." };

  await db.consignmentInventory.update({
    where: { id: consignmentId },
    data: parsed.data,
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "consignment.legacy_counts_update",
    entityType: "ConsignmentInventory",
    entityId: consignmentId,
    before: {
      quantity: existing.quantity,
      sold: existing.soldQuantity,
      returned: existing.returnedQuantity,
      defective: existing.defectiveQuantity,
    },
    after: parsed.data,
  });

  revalidatePath("/konsignation");
  return { success: "Legacy-Bestände aktualisiert." };
}

const stockAdjustmentSchema = z.object({
  targetQuantityAvailable: z.coerce.number().int().min(0).max(100000),
  comment: z.string().min(1, "Grund/Kommentar fehlt.").max(500),
});

export async function adjustConsignmentStockAction(
  inventoryPositionId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await getConsignmentMutationContext();
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { db, organization, userId } = access;

  const parsed = stockAdjustmentSchema.safeParse({
    targetQuantityAvailable: formData.get("targetQuantityAvailable"),
    comment: formData.get("adjustmentComment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Bestandskorrektur." };
  }

  const position = await db.inventoryPosition.findFirst({
    where: { id: inventoryPositionId, inventoryType: "CONSIGNMENT" },
    select: { id: true, quantityAvailable: true, inventoryNumber: true },
  });
  if (!position) return { error: "Konsignationsposition nicht gefunden." };

  const delta = parsed.data.targetQuantityAvailable - position.quantityAvailable;
  if (delta === 0) return { success: "Bestand ist unverändert." };

  try {
    await adjust({
      organizationId: organization.id,
      inventoryPositionId: position.id,
      direction: delta > 0 ? "IN" : "OUT",
      quantity: Math.abs(delta),
      bucket: "AVAILABLE",
      referenceType: "InventoryPosition",
      referenceId: position.id,
      referenceAction: "consignment_stock_adjustment",
      comment: parsed.data.comment,
      createdById: userId,
      requiredInventoryType: "CONSIGNMENT",
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Bestandskorrektur konnte nicht gebucht werden.",
    };
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "consignment.stock_adjustment",
    entityType: "InventoryPosition",
    entityId: position.id,
    before: { quantityAvailable: position.quantityAvailable },
    after: { quantityAvailable: parsed.data.targetQuantityAvailable, comment: parsed.data.comment },
  });

  revalidatePath("/konsignation");
  return { success: `Bestand ${position.inventoryNumber} korrigiert.` };
}

const editConsignmentSchema = z.object({
  partner: z.string().min(1, "Partner fehlt.").max(200),
  title: z.string().min(1, "Artikel fehlt.").max(300),
  brand: z.string().max(120).optional().or(z.literal("")),
  sku: z.string().max(120).optional().or(z.literal("")),
  variant: z.string().max(200).optional().or(z.literal("")),
  ean: z.string().max(80).optional().or(z.literal("")),
  identificationNumber: z.string().max(120).optional().or(z.literal("")),
  category: z.string().max(200).optional().or(z.literal("")),
  costGross: z.string().optional().or(z.literal("")),
  costNet: z.string().optional().or(z.literal("")),
  comment: z.string().max(2000).optional().or(z.literal("")),
});

export async function updateConsignmentItemAction(
  itemId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await getConsignmentMutationContext();
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { db, organization, userId } = access;

  const parsed = editConsignmentSchema.safeParse({
    partner: formData.get("partner"),
    title: formData.get("title"),
    brand: formData.get("brand"),
    sku: formData.get("sku"),
    variant: formData.get("variant"),
    ean: formData.get("ean"),
    identificationNumber: formData.get("identificationNumber"),
    category: formData.get("category"),
    costGross: formData.get("costGross"),
    costNet: formData.get("costNet"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  const position = await db.inventoryPosition.findFirst({
    where: { id: itemId, inventoryType: "CONSIGNMENT" },
    include: { consignmentLot: true },
  });

  if (position?.consignmentLot) {
    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: position.productId },
        data: {
          name: data.title,
          brand: optional(data.brand),
          variant: optional(data.variant || data.sku),
          ean: optional(data.ean),
          category: optional(data.category),
        },
      });
      await tx.consignmentLot.update({
        where: { id: position.consignmentLot!.id },
        data: {
          partnerCompany: data.partner,
          externalSku: optional(data.sku),
          identificationNumber: optional(data.identificationNumber),
          costGross: optionalDecimalFromInput(data.costGross, "EK brutto"),
          costNet: optionalDecimalFromInput(data.costNet, "EK netto"),
          comment: optional(data.comment),
        },
      });
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "consignment.update",
      entityType: "InventoryPosition",
      entityId: position.id,
      after: data,
    });
    revalidatePath("/konsignation");
    return { success: "Konsignationsartikel aktualisiert." };
  }

  const legacy = await db.consignmentInventory.findFirst({ where: { id: itemId } });
  if (!legacy) return { error: "Konsignationsartikel nicht gefunden." };

  await db.consignmentInventory.update({
    where: { id: itemId },
    data: {
      consignorName: data.partner,
      itemTitle: data.title,
      sku: data.sku || legacy.sku,
      consignorContact: optional(data.comment),
    },
  });
  revalidatePath("/konsignation");
  return { success: "Legacy-Konsignationsartikel aktualisiert." };
}

export async function deleteConsignmentItemAction(itemId: string): Promise<ActionState> {
  const access = await getConsignmentMutationContext("ADMIN");
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { db, organization, userId } = access;

  const position = await db.inventoryPosition.findFirst({
    where: { id: itemId, inventoryType: "CONSIGNMENT" },
    include: {
      consignmentLot: { select: { id: true } },
      _count: { select: { saleAllocations: true, debtLinks: true } },
    },
  });

  if (position) {
    if (position._count.saleAllocations > 0 || position._count.debtLinks > 0) {
      return {
        error:
          "Konsignationsartikel ist mit Verkäufen oder Schulden verknüpft und kann nicht gelöscht werden.",
      };
    }
    await db.$transaction(async (tx) => {
      if (position.consignmentLot) {
        await tx.sourceReference.deleteMany({
          where: {
            organizationId: organization.id,
            targetEntity: "CONSIGNMENT_LOT",
            targetEntityId: position.consignmentLot.id,
          },
        });
      }
      await tx.inventoryPosition.delete({ where: { id: position.id } });
    });
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "consignment.delete",
      entityType: "InventoryPosition",
      entityId: position.id,
      before: { inventoryNumber: position.inventoryNumber },
    });
    revalidatePath("/konsignation");
    return { success: "Konsignationsartikel gelöscht." };
  }

  const legacy = await db.consignmentInventory.findFirst({ where: { id: itemId } });
  if (!legacy) return { error: "Konsignationsartikel nicht gefunden." };
  if (legacy.linkedSaleIds.length > 0 || legacy.saleId) {
    return { error: "Legacy-Konsignationsartikel ist mit Verkäufen verknüpft." };
  }
  await db.consignmentInventory.delete({ where: { id: itemId } });
  revalidatePath("/konsignation");
  return { success: "Legacy-Konsignationsartikel gelöscht." };
}

/**
 * Legacy-Verkäufe mit alten ConsignmentInventory-Zeilen verknüpfen.
 * Neue Konsignationsware wird später über SaleLineAllocation verbunden.
 */
export async function linkConsignmentSalesAction(
  consignmentId: string,
  saleIds: string[]
): Promise<ActionState> {
  const access = await getConsignmentMutationContext();
  if (access instanceof FeatureAccessDeniedError) {
    return { error: access.message };
  }
  const { db } = access;

  const parsed = z.array(z.string().min(1)).max(500).safeParse(saleIds);
  if (!parsed.success) return { error: "Ungültige Auswahl." };

  const existing = await db.consignmentInventory.findFirst({
    where: { id: consignmentId },
  });
  if (!existing) return { error: "Legacy-Konsignationsartikel nicht gefunden." };

  const sales = parsed.data.length
    ? await db.sale.findMany({ where: { id: { in: parsed.data } } })
    : [];
  if (sales.length !== parsed.data.length) {
    return { error: "Mindestens ein gewählter Verkauf ist ungültig." };
  }

  await db.consignmentInventory.update({
    where: { id: consignmentId },
    data: { linkedSaleIds: sales.map((sale) => sale.id) },
  });

  revalidatePath("/konsignation");
  return { success: `${sales.length} Verkäufe verknüpft.` };
}

function parseOptionalMoney(
  value: string | undefined,
  label: string
): number | null {
  if (!value?.trim()) return null;
  try {
    return euroToCents(value);
  } catch {
    throw new Error(`${label} ist kein gültiger Euro-Betrag.`);
  }
}
function optional(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalDecimalFromInput(
  value: string | undefined,
  label: string
): string | undefined {
  const cents = parseOptionalMoney(value, label);
  return cents == null ? undefined : (cents / 100).toFixed(2);
}


