"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const debtSchema = z.object({
  debtDate: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "Beschreibung fehlt.").max(500),
  amount: z
    .string()
    .min(1, "Betrag fehlt.")
    .refine((v) => {
      try {
        return euroToCents(v) > 0;
      } catch {
        return false;
      }
    }, "Ungültiger Betrag."),
  debtorName: z.string().min(1, "Schuldner fehlt.").max(200),
  creditorName: z.string().min(1, "Gläubiger fehlt.").max(200),
});

/** Forderung/Verbindlichkeit zwischen Gesellschaftern anlegen. */
export async function createDebtAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = debtSchema.safeParse({
    debtDate: formData.get("debtDate"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    debtorName: formData.get("debtorName"),
    creditorName: formData.get("creditorName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  if (data.debtorName.trim().toLowerCase() === data.creditorName.trim().toLowerCase()) {
    return { error: "Schuldner und Gläubiger dürfen nicht identisch sein." };
  }

  const debt = await db.debt.create({
    data: {
      organizationId: organization.id,
      debtDate: data.debtDate ? new Date(data.debtDate) : new Date(),
      description: data.description,
      amountCents: euroToCents(data.amount),
      debtorName: data.debtorName.trim(),
      creditorName: data.creditorName.trim(),
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "debt.create",
    entityType: "Debt",
    entityId: debt.id,
    after: {
      debtor: debt.debtorName,
      creditor: debt.creditorName,
      amountCents: debt.amountCents,
    },
  });

  revalidatePath("/schulden");
  return { success: "Eintrag angelegt." };
}

/** Schuld als beglichen markieren (oder wieder öffnen). */
export async function toggleDebtSettledAction(
  debtId: string,
  settled: boolean
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.debt.findFirst({ where: { id: debtId } });
  if (!existing) return { error: "Eintrag nicht gefunden." };

  await db.debt.update({
    where: { id: debtId },
    data: {
      status: settled ? "SETTLED" : "OPEN",
      settledAt: settled ? new Date() : null,
      paidCents: settled ? existing.amountCents : 0,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: settled ? "debt.settle" : "debt.reopen",
    entityType: "Debt",
    entityId: debtId,
  });

  revalidatePath("/schulden");
  return { success: settled ? "Als beglichen markiert." : "Wieder geöffnet." };
}

/** Eintrag löschen (nur OWNER/ADMIN). */
export async function deleteDebtAction(debtId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const existing = await db.debt.findFirst({ where: { id: debtId } });
  if (!existing) return { error: "Eintrag nicht gefunden." };

  await db.debt.delete({ where: { id: debtId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "debt.delete",
    entityType: "Debt",
    entityId: debtId,
    before: { description: existing.description, amountCents: existing.amountCents },
  });

  revalidatePath("/schulden");
  return { success: "Eintrag gelöscht." };
}
