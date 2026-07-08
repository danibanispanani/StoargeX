"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";
import { createConsignmentStock } from "@/lib/services/consignment-service";
import {
  markReturnDefective,
  receiveReturn,
  sell,
} from "@/lib/services/inventory-service";

const priceTiersSchema = z.array(
  z.object({
    label: z.string().min(1).max(100),
    cents: z.number().int().min(0),
  })
);

const optionalInt = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().min(0).max(100000).optional()
);

const consignmentSchema = z.object({
  consignorName: z.string().min(1, "Partnerfirma fehlt.").max(200),
  consignorContact: z.string().max(200).optional().or(z.literal("")),
  itemTitle: z.string().min(1, "Artikelbezeichnung fehlt.").max(300),
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
  priceTiersJson: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function parsePriceTiers(json: string | undefined) {
  if (!json?.trim()) return { tiers: [] as z.infer<typeof priceTiersSchema> };
  try {
    const validated = priceTiersSchema.safeParse(JSON.parse(json));
    if (!validated.success) {
      return {
        error: 'Preisebenen-JSON ungültig. Erwartet: [{"label":"VK Standard","cents":4999}]',
      };
    }
    return { tiers: validated.data };
  } catch {
    return { error: "Preisebenen sind kein gültiges JSON." };
  }
}

/** Neue Konsignationsartikel über InventoryPosition + ConsignmentLot anlegen. */
export async function createConsignmentItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  const parsed = consignmentSchema.safeParse({
    consignorName: formData.get("consignorName"),
    consignorContact: formData.get("consignorContact"),
    itemTitle: formData.get("itemTitle"),
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
    priceTiersJson: formData.get("priceTiersJson"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const data = parsed.data;
  const tiersResult = parsePriceTiers(data.priceTiersJson);
  if ("error" in tiersResult) return { error: tiersResult.error };

  try {
    const result = await createConsignmentStock({
      organizationId: organization.id,
      createdById: userId,
      partnerCompany: data.consignorName,
      externalSku: data.sku,
      productName: data.itemTitle,
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
      channelPrices: tiersResult.tiers,
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
  const { db, organization, userId } = await requireOrg("MEMBER");

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

const inventoryMovementSchema = z.object({
  operation: z.enum(["SELL", "RETURN_INSPECTION", "DEFECTIVE"]),
  quantity: z.coerce.number().int().min(1).max(100000),
  comment: z.string().max(500).optional().or(z.literal("")),
  idempotencyKey: z.string().min(1).max(200).optional().or(z.literal("")),
});

/** Neue Konsignationsbestände nur über InventoryMovement verändern. */
export async function moveConsignmentInventoryAction(
  inventoryPositionId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = inventoryMovementSchema.safeParse({
    operation: formData.get("operation"),
    quantity: formData.get("quantity"),
    comment: formData.get("comment"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Bewegung." };
  }

  const position = await db.inventoryPosition.findFirst({
    where: {
      id: inventoryPositionId,
      inventoryType: "CONSIGNMENT",
    },
    select: { id: true, inventoryNumber: true },
  });
  if (!position) return { error: "Konsignationsposition nicht gefunden." };

  const data = parsed.data;
  const common = {
    organizationId: organization.id,
    inventoryPositionId,
    quantity: data.quantity,
    referenceType: "ConsignmentLot",
    referenceId: inventoryPositionId,
    comment: data.comment || undefined,
    createdById: userId,
    requiredInventoryType: "CONSIGNMENT" as const,
    idempotencyKey:
      data.idempotencyKey ||
      `consignment:${inventoryPositionId}:${data.operation}:${Date.now()}`,
  };

  try {
    if (data.operation === "SELL") {
      await sell({
        ...common,
        referenceAction: "manual_consignment_sale_out",
      });
    } else if (data.operation === "RETURN_INSPECTION") {
      await receiveReturn({
        ...common,
        referenceAction: "manual_consignment_return_receipt",
      });
    } else {
      await markReturnDefective({
        ...common,
        referenceAction: "manual_consignment_return_defective",
      });
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Bestandsbewegung fehlgeschlagen.",
    };
  }

  revalidatePath("/konsignation");
  return { success: `Bestand ${position.inventoryNumber} aktualisiert.` };
}

/**
 * Legacy-Verkäufe mit alten ConsignmentInventory-Zeilen verknüpfen.
 * Neue Konsignationsware wird später über SaleLineAllocation verbunden.
 */
export async function linkConsignmentSalesAction(
  consignmentId: string,
  saleIds: string[]
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

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
