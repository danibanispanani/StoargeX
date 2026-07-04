"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const surchargesSchema = z.array(
  z.object({
    label: z.string().min(1).max(100),
    cents: z.number().int().min(0),
  })
);

const rateSchema = z.object({
  carrierName: z.string().min(1, "Dienstleister fehlt.").max(100),
  name: z.string().min(1, "Tarifname fehlt.").max(200),
  zone: z.string().min(1, "Zone fehlt.").max(100),
  countries: z
    .string()
    .transform((v) =>
      v
        .split(/[,\s]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    )
    .refine(
      (arr) => arr.every((c) => /^[A-Z]{2}$/.test(c)),
      "Länder als ISO-2-Kürzel angeben, z.B. DE, AT, CH."
    ),
  basePrice: z.string().min(1, "Grundpreis fehlt."),
  perKgPrice: z.string().optional().or(z.literal("")),
  maxWeightKg: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  surchargesJson: z.string().optional().or(z.literal("")),
});

function parseRateForm(formData: FormData) {
  const parsed = rateSchema.safeParse({
    carrierName: formData.get("carrierName"),
    name: formData.get("name"),
    zone: formData.get("zone"),
    countries: formData.get("countries") ?? "",
    basePrice: formData.get("basePrice"),
    perKgPrice: formData.get("perKgPrice"),
    maxWeightKg: formData.get("maxWeightKg") || "",
    surchargesJson: formData.get("surchargesJson"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }
  const data = parsed.data;

  let baseCents: number;
  let perKgCents: number;
  try {
    baseCents = euroToCents(data.basePrice);
    perKgCents = data.perKgPrice?.trim() ? euroToCents(data.perKgPrice) : 0;
  } catch {
    return { error: "Ungültiger Preis." } as const;
  }

  // Zuschläge als JSON: [{ "label": "Sperrgut", "cents": 500 }]
  let surcharges: z.infer<typeof surchargesSchema> = [];
  if (data.surchargesJson?.trim()) {
    try {
      const json = JSON.parse(data.surchargesJson);
      const validated = surchargesSchema.safeParse(json);
      if (!validated.success) {
        return {
          error: 'Zuschläge-JSON ungültig. Erwartet: [{"label":"Sperrgut","cents":500}]',
        } as const;
      }
      surcharges = validated.data;
    } catch {
      return { error: "Zuschläge sind kein gültiges JSON." } as const;
    }
  }

  return {
    values: {
      carrierName: data.carrierName,
      name: data.name,
      zone: data.zone,
      countries: data.countries,
      baseCents,
      perKgCents,
      maxWeightKg: data.maxWeightKg === "" || data.maxWeightKg === undefined ? null : data.maxWeightKg,
      surcharges,
    },
  } as const;
}

/** Versandtarif anlegen. */
export async function createShippingRateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const result = parseRateForm(formData);
  if ("error" in result) return { error: result.error };

  const rate = await db.shippingRate.create({
    data: { organizationId: organization.id, ...result.values },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "shipping_rate.create",
    entityType: "ShippingRate",
    entityId: rate.id,
    after: { carrierName: rate.carrierName, name: rate.name, zone: rate.zone },
  });

  revalidatePath("/versand");
  return { success: `Tarif "${rate.carrierName} ${rate.name}" angelegt.` };
}

/** Versandtarif aktualisieren. */
export async function updateShippingRateAction(
  rateId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.shippingRate.findFirst({ where: { id: rateId } });
  if (!existing) return { error: "Tarif nicht gefunden." };

  const result = parseRateForm(formData);
  if ("error" in result) return { error: result.error };

  await db.shippingRate.update({ where: { id: rateId }, data: result.values });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "shipping_rate.update",
    entityType: "ShippingRate",
    entityId: rateId,
    before: { name: existing.name },
    after: { name: result.values.name },
  });

  revalidatePath("/versand");
  return { success: "Tarif aktualisiert." };
}

/** Versandtarif (de)aktivieren. */
export async function toggleShippingRateAction(
  rateId: string,
  active: boolean
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const existing = await db.shippingRate.findFirst({ where: { id: rateId } });
  if (!existing) return { error: "Tarif nicht gefunden." };

  await db.shippingRate.update({
    where: { id: rateId },
    data: { active: Boolean(active) },
  });

  revalidatePath("/versand");
  return { success: active ? "Tarif aktiviert." : "Tarif deaktiviert." };
}

/** Versandtarif löschen. */
export async function deleteShippingRateAction(rateId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const existing = await db.shippingRate.findFirst({ where: { id: rateId } });
  if (!existing) return { error: "Tarif nicht gefunden." };

  await db.shippingRate.delete({ where: { id: rateId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "shipping_rate.delete",
    entityType: "ShippingRate",
    entityId: rateId,
    before: { carrierName: existing.carrierName, name: existing.name },
  });

  revalidatePath("/versand");
  return { success: "Tarif gelöscht." };
}
