"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LegalForm } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

const orgSchema = z.object({
  name: z.string().min(2, "Firmenname ist zu kurz.").max(200),
  legalForm: z.nativeEnum(LegalForm),
  vatId: z.string().max(20).optional().or(z.literal("")),
  taxNumber: z.string().max(30).optional().or(z.literal("")),
  street: z.string().max(200).optional().or(z.literal("")),
  zipCode: z.string().max(10).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
});

/** Schwellenwert für die Niedrig-Bestand-Warnung setzen (nur OWNER/ADMIN). */
export async function updateLowStockThresholdAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization } = await requireOrg("ADMIN");

  const parsed = z.coerce.number().int().min(0).max(1000).safeParse(
    formData.get("lowStockThreshold")
  );
  if (!parsed.success) return { error: "Ungültiger Schwellenwert (0–1000)." };

  await db.organization.update({
    where: { id: organization.id },
    data: { lowStockThreshold: parsed.data },
  });

  revalidatePath("/einstellungen");
  revalidatePath("/dashboard");
  revalidatePath("/lager");
  return { success: `Warnschwelle auf ${parsed.data} gesetzt ✓` };
}

/** Firmendaten aktualisieren (nur OWNER/ADMIN). */
export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    legalForm: formData.get("legalForm"),
    vatId: formData.get("vatId"),
    taxNumber: formData.get("taxNumber"),
    street: formData.get("street"),
    zipCode: formData.get("zipCode"),
    city: formData.get("city"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  await db.organization.update({
    where: { id: organization.id },
    data: {
      name: data.name,
      legalForm: data.legalForm,
      vatId: data.vatId || null,
      taxNumber: data.taxNumber || null,
      street: data.street || null,
      zipCode: data.zipCode || null,
      city: data.city || null,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "organization.update",
    entityType: "Organization",
    entityId: organization.id,
    before: { name: organization.name, vatId: organization.vatId },
    after: { name: data.name, vatId: data.vatId },
  });

  revalidatePath("/einstellungen");
  return { success: "Firmendaten gespeichert." };
}
