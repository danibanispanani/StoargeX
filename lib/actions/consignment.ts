"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const priceTiersSchema = z.array(
  z.object({
    label: z.string().min(1).max(100),
    cents: z.number().int().min(0),
  })
);

const consignmentSchema = z.object({
  consignorName: z.string().min(1, "Partnerfirma fehlt.").max(200),
  consignorContact: z.string().max(200).optional().or(z.literal("")),
  itemTitle: z.string().min(1, "Artikelbezeichnung fehlt.").max(300),
  sku: z.string().max(50).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).max(100000),
  priceTiersJson: z.string().optional().or(z.literal("")),
  commissionPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  agreedPayout: z.string().optional().or(z.literal("")),
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

/** Konsignationsartikel (Fremdfirmen-Ware) anlegen. */
export async function createConsignmentItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = consignmentSchema.safeParse({
    consignorName: formData.get("consignorName"),
    consignorContact: formData.get("consignorContact"),
    itemTitle: formData.get("itemTitle"),
    sku: formData.get("sku"),
    quantity: formData.get("quantity") ?? 0,
    priceTiersJson: formData.get("priceTiersJson"),
    commissionPercent: formData.get("commissionPercent") || "",
    agreedPayout: formData.get("agreedPayout"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  const tiersResult = parsePriceTiers(data.priceTiersJson);
  if ("error" in tiersResult) return { error: tiersResult.error };

  let agreedPayoutCents: number | null = null;
  if (data.agreedPayout?.trim()) {
    try {
      agreedPayoutCents = euroToCents(data.agreedPayout);
    } catch {
      return { error: "Ungültiger Auszahlungsbetrag." };
    }
  }

  // Eigene SKU/ID für Konsignationsware: K-<Base36-Zeitstempel> falls leer
  const sku =
    data.sku?.trim() ||
    `K-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;

  const existing = await db.consignmentInventory.findFirst({ where: { sku } });
  if (existing) return { error: `SKU "${sku}" existiert bereits.` };

  const item = await db.consignmentInventory.create({
    data: {
      organizationId: organization.id,
      sku,
      consignorName: data.consignorName,
      consignorContact: data.consignorContact || null,
      itemTitle: data.itemTitle,
      quantity: data.quantity,
      priceTiers: tiersResult.tiers,
      commissionPercent:
        data.commissionPercent === "" || data.commissionPercent === undefined
          ? null
          : data.commissionPercent,
      agreedPayoutCents,
      notes: data.notes || null,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "consignment.create",
    entityType: "ConsignmentInventory",
    entityId: item.id,
    after: { sku: item.sku, consignor: item.consignorName, quantity: item.quantity },
  });

  revalidatePath("/konsignation");
  return { success: `Konsignationsartikel ${item.sku} angelegt.` };
}

const countsSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(100000),
  soldQuantity: z.coerce.number().int().min(0).max(100000),
  returnedQuantity: z.coerce.number().int().min(0).max(100000),
  defectiveQuantity: z.coerce.number().int().min(0).max(100000),
});

/** Bestandszähler (Bestand/verkauft/retourniert/defekt) aktualisieren. */
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
  if (!existing) return { error: "Konsignationsartikel nicht gefunden." };

  await db.consignmentInventory.update({
    where: { id: consignmentId },
    data: parsed.data,
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "consignment.counts_update",
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
  return { success: "Bestände aktualisiert." };
}

/**
 * Verkäufe aus dem Konsignationsbestand mit echten Sale-Einträgen verknüpfen
 * (linked_sale_ids), damit Umsatz/Marge separat auswertbar sind.
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
  if (!existing) return { error: "Konsignationsartikel nicht gefunden." };

  // Nur Sales der eigenen Organisation zulassen (Tenant-Kontext + Existenzprüfung)
  const sales = parsed.data.length
    ? await db.sale.findMany({ where: { id: { in: parsed.data } } })
    : [];
  if (sales.length !== parsed.data.length) {
    return { error: "Mindestens ein gewählter Verkauf ist ungültig." };
  }

  await db.consignmentInventory.update({
    where: { id: consignmentId },
    data: { linkedSaleIds: sales.map((s) => s.id) },
  });

  revalidatePath("/konsignation");
  return { success: `${sales.length} Verkäufe verknüpft.` };
}
