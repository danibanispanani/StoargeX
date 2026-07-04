"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { formatOrderId } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const taxRateSchema = z.object({
  name: z.string().min(1, "Name fehlt.").max(200),
  ratePercent: z.coerce.number().min(0, "Satz darf nicht negativ sein.").max(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Land als ISO-2-Kürzel angeben (z.B. DE).")
    .optional()
    .or(z.literal("")),
  isDefault: z.coerce.boolean(),
});

/** USt-Satz anlegen/aktualisieren (nur OWNER/ADMIN, editierbar in den Einstellungen). */
export async function upsertTaxRateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = taxRateSchema.safeParse({
    name: formData.get("name"),
    ratePercent: formData.get("ratePercent"),
    country: formData.get("country"),
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;
  const rateId = String(formData.get("rateId") ?? "");

  if (rateId) {
    const existing = await db.taxRate.findFirst({ where: { id: rateId } });
    if (!existing) return { error: "Steuersatz nicht gefunden." };
  }

  // Es darf nur einen Default geben
  if (data.isDefault) {
    await db.taxRate.updateMany({ data: { isDefault: false } });
  }

  const values = {
    name: data.name,
    ratePercent: data.ratePercent,
    country: data.country || null,
    isDefault: data.isDefault,
  };

  const rate = rateId
    ? await db.taxRate.update({ where: { id: rateId }, data: values })
    : await db.taxRate.create({
        data: { organizationId: organization.id, ...values },
      });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: rateId ? "tax_rate.update" : "tax_rate.create",
    entityType: "TaxRate",
    entityId: rate.id,
    after: { name: rate.name, ratePercent: data.ratePercent, country: rate.country },
  });

  revalidatePath("/einstellungen");
  return { success: "Steuersatz gespeichert." };
}

/** USt-Satz löschen (nur OWNER/ADMIN). */
export async function deleteTaxRateAction(rateId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const existing = await db.taxRate.findFirst({ where: { id: rateId } });
  if (!existing) return { error: "Steuersatz nicht gefunden." };

  await db.taxRate.delete({ where: { id: rateId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "tax_rate.delete",
    entityType: "TaxRate",
    entityId: rateId,
    before: { name: existing.name },
  });

  revalidatePath("/einstellungen");
  return { success: "Steuersatz gelöscht." };
}

const orderFormatSchema = z.object({
  orderIdFormat: z
    .string()
    .min(1, "Format fehlt.")
    .max(100)
    .refine(
      (f) => /\{NR(:\d+)?\}/.test(f),
      "Das Format muss den Token {NR} oder {NR:n} enthalten."
    ),
});

/** Order-ID-Format konfigurieren (nur OWNER/ADMIN). */
export async function updateOrderIdFormatAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = orderFormatSchema.safeParse({
    orderIdFormat: formData.get("orderIdFormat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültiges Format." };
  }

  await db.organization.update({
    where: { id: organization.id },
    data: { orderIdFormat: parsed.data.orderIdFormat },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "organization.order_format_change",
    entityType: "Organization",
    entityId: organization.id,
    before: { orderIdFormat: organization.orderIdFormat },
    after: { orderIdFormat: parsed.data.orderIdFormat },
  });

  revalidatePath("/einstellungen");
  const preview = formatOrderId(parsed.data.orderIdFormat, 42, new Date());
  return { success: `Format gespeichert. Beispiel: ${preview}` };
}
