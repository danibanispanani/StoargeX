"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DebtEntry, DebtKind, DebtStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const debtSchema = z.object({
  debtDate: z.string().optional().or(z.literal("")),
  refId: z.string().max(100).optional().or(z.literal("")), // Lager-/Order-ID
  description: z.string().min(1, "Artikelbeschreibung fehlt.").max(500),
  kind: z.nativeEnum(DebtKind).default("SONSTIGES"),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
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
  creditorName: z.string().min(1, "Empfänger fehlt.").max(200),
  status: z.nativeEnum(DebtStatus).default("OPEN"),
  entryStatus: z.nativeEnum(DebtEntry).default("IO"),
  settledAt: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")), // Kommentar
});

function parseDebtForm(formData: FormData) {
  const parsed = debtSchema.safeParse({
    debtDate: formData.get("debtDate"),
    refId: formData.get("refId"),
    description: formData.get("description"),
    kind: formData.get("kind") || "SONSTIGES",
    quantity: formData.get("quantity") || 1,
    amount: formData.get("amount"),
    debtorName: formData.get("debtorName"),
    creditorName: formData.get("creditorName"),
    status: formData.get("status") || "OPEN",
    entryStatus: formData.get("entryStatus") || "IO",
    settledAt: formData.get("settledAt"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }
  if (
    parsed.data.debtorName.trim().toLowerCase() ===
    parsed.data.creditorName.trim().toLowerCase()
  ) {
    return { error: "Schuldner und Empfänger dürfen nicht identisch sein." } as const;
  }
  return { data: parsed.data, amountCents: euroToCents(parsed.data.amount) } as const;
}

function debtValues(data: z.infer<typeof debtSchema>, amountCents: number) {
  const settled = data.status === "SETTLED";
  return {
    debtDate: data.debtDate ? new Date(data.debtDate) : new Date(),
    refId: data.refId || null,
    description: data.description,
    kind: data.kind,
    quantity: data.quantity,
    amountCents,
    paidCents: settled ? amountCents : 0,
    debtorName: data.debtorName.trim(),
    creditorName: data.creditorName.trim(),
    status: data.status,
    entryStatus: data.entryStatus,
    settledAt: settled
      ? data.settledAt
        ? new Date(data.settledAt)
        : new Date()
      : null,
    notes: data.notes || null,
  };
}

/** Schuld manuell eintragen. */
export async function createDebtAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const result = parseDebtForm(formData);
  if ("error" in result) return { error: result.error };

  const debt = await db.debt.create({
    data: {
      organizationId: organization.id,
      ...debtValues(result.data, result.amountCents),
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
      kind: debt.kind,
    },
  });

  revalidatePath("/schulden");
  return { success: "Schulden-Eintrag angelegt ✓" };
}

/** Schulden-Eintrag vollständig bearbeiten. */
export async function updateDebtAction(
  debtId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.debt.findFirst({ where: { id: debtId } });
  if (!existing) return { error: "Eintrag nicht gefunden." };

  const result = parseDebtForm(formData);
  if ("error" in result) return { error: result.error };

  await db.debt.update({
    where: { id: debtId },
    data: debtValues(result.data, result.amountCents),
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "debt.update",
    entityType: "Debt",
    entityId: debtId,
    before: { amountCents: existing.amountCents, status: existing.status },
    after: { amountCents: result.amountCents, status: result.data.status },
  });

  revalidatePath("/schulden");
  return { success: "Schulden-Eintrag gespeichert ✓" };
}

/** Status umschalten (Offen/Beglichen/Sonstiges) – Begleichung setzt das Datum. */
export async function updateDebtStatusAction(
  debtId: string,
  status: DebtStatus
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = z.enum(["OPEN", "SETTLED", "OTHER"]).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const existing = await db.debt.findFirst({ where: { id: debtId } });
  if (!existing) return { error: "Eintrag nicht gefunden." };

  await db.debt.update({
    where: { id: debtId },
    data: {
      status: parsed.data,
      settledAt: parsed.data === "SETTLED" ? existing.settledAt ?? new Date() : null,
      paidCents: parsed.data === "SETTLED" ? existing.amountCents : 0,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: parsed.data === "SETTLED" ? "debt.settle" : "debt.status_change",
    entityType: "Debt",
    entityId: debtId,
  });

  revalidatePath("/schulden");
  return { success: "Schulden-Status geändert ✓" };
}

/** Buchhaltungs-Marker I.O / Fehlt umschalten. */
export async function updateDebtEntryAction(
  debtId: string,
  entryStatus: DebtEntry
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(DebtEntry).safeParse(entryStatus);
  if (!parsed.success) return { error: "Ungültiger Wert." };

  const existing = await db.debt.findFirst({ where: { id: debtId } });
  if (!existing) return { error: "Eintrag nicht gefunden." };

  await db.debt.update({
    where: { id: debtId },
    data: { entryStatus: parsed.data },
  });

  revalidatePath("/schulden");
  return { success: `Eintrag-Status: ${parsed.data === "IO" ? "I.O" : "Fehlt"} ✓` };
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
  return { success: "Schulden-Eintrag gelöscht ✓" };
}
