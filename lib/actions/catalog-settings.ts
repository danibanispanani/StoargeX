"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OptionKind } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

/** Plattform/Account hinzufügen (z.B. weiterer eBay-Account). */
export async function addPlatformAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = z
    .string()
    .min(1, "Name fehlt.")
    .max(100)
    .safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = await db.platform.findFirst({ where: { name: parsed.data } });
  if (existing) return { error: "Diese Plattform existiert bereits." };

  await db.platform.create({
    data: { organizationId: organization.id, name: parsed.data },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "platform.create",
    entityType: "Platform",
    after: { name: parsed.data },
  });

  revalidatePath("/einstellungen");
  revalidatePath("/lager");
  revalidatePath("/verkauf");
  return { success: `Plattform "${parsed.data}" angelegt ✓` };
}

/** Plattform aktivieren/deaktivieren. */
export async function togglePlatformAction(
  platformId: string,
  active: boolean
): Promise<ActionState> {
  const { db } = await requireOrg("ADMIN");

  const platform = await db.platform.findFirst({ where: { id: platformId } });
  if (!platform) return { error: "Plattform nicht gefunden." };

  await db.platform.update({
    where: { id: platformId },
    data: { active: Boolean(active) },
  });

  revalidatePath("/einstellungen");
  revalidatePath("/lager");
  revalidatePath("/verkauf");
  return {
    success: `Plattform "${platform.name}" ${active ? "aktiviert" : "deaktiviert"} ✓`,
  };
}

/** Auswahlwert (ZM / Auszahlungsempfänger) hinzufügen. */
export async function addSelectOptionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

    const parsed = z
    .object({
      kind: z.nativeEnum(OptionKind),
      label: z.string().min(1, "Wert fehlt.").max(100),
    })
    .safeParse({ kind: formData.get("kind"), label: formData.get("label") });
  if (!parsed.success) return { error: "Ungültige Eingaben." };

  const existing = await db.selectOption.findFirst({
    where: { kind: parsed.data.kind, label: parsed.data.label },
  });
  if (existing) {
    if (!existing.active) {
      await db.selectOption.update({
        where: { id: existing.id },
        data: { active: true },
      });
      revalidatePath("/einstellungen");
      return { success: `"${parsed.data.label}" reaktiviert ✓` };
    }
    return { error: "Dieser Wert existiert bereits." };
  }

  const count = await db.selectOption.count({ where: { kind: parsed.data.kind } });
  await db.selectOption.create({
    data: {
      organizationId: organization.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      sortOrder: count,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "select_option.create",
    after: { kind: parsed.data.kind, label: parsed.data.label },
  });

  revalidatePath("/einstellungen");
  return { success: `"${parsed.data.label}" hinzugefügt ✓` };
}

/** Auswahlwert deaktivieren (bestehende Datensätze behalten den Wert). */
export async function removeSelectOptionAction(optionId: string): Promise<ActionState> {
  const { db } = await requireOrg("ADMIN");

  const option = await db.selectOption.findFirst({ where: { id: optionId } });
  if (!option) return { error: "Wert nicht gefunden." };

  await db.selectOption.update({
    where: { id: optionId },
    data: { active: false },
  });

  revalidatePath("/einstellungen");
  return { success: `"${option.label}" entfernt ✓` };
}
