"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { euroToCents, grossToNetCents } from "@/lib/calculations";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { buildExpenseOccurrenceKey, planExpenseOccurrences } from "@/lib/services/expense-occurrence-service";
import { centsToDecimalString } from "@/lib/services/owned-purchase-service";
import type { ActionState } from "@/lib/actions/team";

const expenseSchema = z.object({
  description: z.string().trim().min(1, "Bezeichnung fehlt.").max(300),
  categoryName: z.string().trim().max(100).optional(),
  supplierId: z.string().trim().optional(),
  paymentAccountId: z.string().trim().optional(),
  marketplaceAccountId: z.string().trim().optional(),
  amountGrossCents: z.number().int().min(0),
  amountNetCents: z.number().int().min(0).nullable(),
  taxRatePercent: z.number().min(0).max(100),
  incurredAt: z.date(),
  dueAt: z.date().nullable(),
  paidAt: z.date().nullable(),
  status: z.enum(["DRAFT", "POSTED", "CANCELLED"]),
  receiptReference: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  recurring: z.boolean(),
  interval: z.enum(["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]),
  intervalCount: z.number().int().min(1).max(120),
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
});

export async function createExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { db, organization, userId, membership } = await requireOrg("MEMBER");
  if (membership.role === "READONLY") return { error: "Nur Mitglieder mit Schreibrecht dürfen Ausgaben anlegen." };
  const grossText = String(formData.get("amountGross") ?? "");
  const netText = String(formData.get("amountNet") ?? "").trim();
  const parsed = expenseSchema.safeParse({
    description: formData.get("description"),
    categoryName: optionalText(formData.get("categoryName")),
    supplierId: optionalText(formData.get("supplierId")),
    paymentAccountId: optionalText(formData.get("paymentAccountId")),
    marketplaceAccountId: optionalText(formData.get("marketplaceAccountId")),
    amountGrossCents: parseMoney(grossText),
    amountNetCents: netText ? parseMoney(netText) : null,
    taxRatePercent: parsePercent(formData.get("taxRatePercent")),
    incurredAt: parseDate(formData.get("incurredAt")),
    dueAt: parseOptionalDate(formData.get("dueAt")),
    paidAt: parseOptionalDate(formData.get("paidAt")),
    status: formData.get("status"),
    receiptReference: optionalText(formData.get("receiptReference")),
    notes: optionalText(formData.get("notes")),
    recurring: formData.get("recurring") === "on",
    interval: formData.get("interval") || "MONTH",
    intervalCount: Number(formData.get("intervalCount") || 1),
    startsAt: parseOptionalDate(formData.get("startsAt")),
    endsAt: parseOptionalDate(formData.get("endsAt")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Ausgabe." };
  const data = parsed.data;
  if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) return { error: "Enddatum muss nach dem Startdatum liegen." };
  if (data.amountNetCents !== null && data.amountNetCents > data.amountGrossCents) return { error: "Der Nettobetrag darf den Bruttobetrag nicht überschreiten." };
  const [supplier, paymentAccount, marketplaceAccount, category] = await Promise.all([
    data.supplierId ? db.businessPartner.findFirst({ where: { id: data.supplierId } }) : Promise.resolve(null),
    data.paymentAccountId ? db.payoutAccount.findFirst({ where: { id: data.paymentAccountId } }) : Promise.resolve(null),
    data.marketplaceAccountId ? db.marketplaceAccount.findFirst({ where: { id: data.marketplaceAccountId } }) : Promise.resolve(null),
    data.categoryName ? db.expenseCategory.upsert({ where: { organizationId_name: { organizationId: organization.id, name: data.categoryName } }, create: { organizationId: organization.id, name: data.categoryName }, update: { active: true } }) : Promise.resolve(null),
  ]);
  if (data.supplierId && !supplier) return { error: "Lieferant nicht gefunden." };
  if (data.paymentAccountId && !paymentAccount) return { error: "Zahlungskonto nicht gefunden." };
  if (data.marketplaceAccountId && !marketplaceAccount) return { error: "Marktplatzkonto nicht gefunden." };
  const netCents = data.amountNetCents ?? grossToNetCents(data.amountGrossCents, data.taxRatePercent);
  const expense = await db.expense.create({
    data: {
      organizationId: organization.id,
      categoryId: category?.id,
      supplierId: supplier?.id,
      paymentAccountId: paymentAccount?.id,
      marketplaceAccountId: marketplaceAccount?.id,
      description: data.description,
      incurredAt: data.incurredAt,
      dueAt: data.dueAt,
      paidAt: data.paidAt,
      amountGross: centsToDecimalString(data.amountGrossCents),
      amountNet: centsToDecimalString(netCents),
      taxRatePercent: data.taxRatePercent.toFixed(2),
      taxAmount: centsToDecimalString(data.amountGrossCents - netCents),
      receiptReference: data.receiptReference || null,
      notes: data.notes || null,
      status: data.status,
    },
  });
  if (data.recurring) {
    const startsAt = data.startsAt ?? data.incurredAt;
    const recurrence = await db.expenseRecurrenceRule.create({
      data: { organizationId: organization.id, expenseId: expense.id, interval: data.interval, intervalCount: data.intervalCount, startsAt, endsAt: data.endsAt, nextOccurrenceAt: startsAt },
    });
    await db.expense.update({ where: { id: expense.id }, data: { occurrenceKey: buildExpenseOccurrenceKey(recurrence.id, startsAt) } });
  }
  await writeAuditLog({ organizationId: organization.id, userId, action: "expense.create", entityType: "Expense", entityId: expense.id, after: { description: data.description, amountGrossCents: data.amountGrossCents, recurring: data.recurring } });
  revalidatePath("/finanzen/ausgaben");
  return { success: "Ausgabe angelegt ✓" };
}

export async function materializeExpenseOccurrencesAction(throughIso?: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");
  const through = throughIso ? new Date(throughIso) : new Date();
  if (Number.isNaN(through.getTime())) return { error: "Ungültiges Materialisierungsdatum." };
  const rules = await db.expenseRecurrenceRule.findMany({
    where: { active: true, startsAt: { lte: through }, OR: [{ endsAt: null }, { endsAt: { gte: new Date(0) } }] },
    include: { expense: true },
  });
  let created = 0;
  await db.$transaction(async (tx) => {
    for (const rule of rules) {
      const existing = await tx.expense.findMany({ where: { recurringSourceExpenseId: rule.expenseId }, select: { occurrenceKey: true } });
      const baseKey = buildExpenseOccurrenceKey(rule.id, rule.startsAt);
      const plans = planExpenseOccurrences({ ruleId: rule.id, interval: rule.interval, intervalCount: rule.intervalCount, startsAt: rule.startsAt, endsAt: rule.endsAt }, through, [baseKey, ...existing.map((item) => item.occurrenceKey).filter((key): key is string => Boolean(key))]);
      for (const plan of plans) {
        await tx.expense.create({
          data: {
            organizationId: organization.id,
            categoryId: rule.expense.categoryId,
            supplierId: rule.expense.supplierId,
            paymentAccountId: rule.expense.paymentAccountId,
            marketplaceAccountId: rule.expense.marketplaceAccountId,
            recurringSourceExpenseId: rule.expenseId,
            occurrenceKey: plan.occurrenceKey,
            description: rule.expense.description,
            incurredAt: plan.at,
            dueAt: plan.at,
            amountGross: rule.expense.amountGross,
            amountNet: rule.expense.amountNet,
            taxRatePercent: rule.expense.taxRatePercent,
            taxAmount: rule.expense.taxAmount,
            receiptReference: rule.expense.receiptReference,
            notes: rule.expense.notes,
            status: "DRAFT",
          },
        });
        created++;
      }
      const next = planExpenseOccurrences({ ruleId: rule.id, interval: rule.interval, intervalCount: rule.intervalCount, startsAt: rule.startsAt, endsAt: rule.endsAt }, new Date(through.getTime() + 366 * 24 * 60 * 60 * 1000), [baseKey, ...existing.map((item) => item.occurrenceKey).filter((key): key is string => Boolean(key)), ...plans.map((item) => item.occurrenceKey)]).find((item) => item.at > through);
      await tx.expenseRecurrenceRule.update({ where: { id: rule.id }, data: { nextOccurrenceAt: next?.at ?? null, active: Boolean(next) } });
    }
  });
  await writeAuditLog({ organizationId: organization.id, userId, action: "expense.occurrences.materialize", entityType: "Expense", after: { through: through.toISOString(), created } });
  revalidatePath("/finanzen/ausgaben");
  return { success: `${created} neue Ausgaben-Vorkommen erzeugt ✓` };
}

function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function parseMoney(value: string) { try { return euroToCents(value); } catch { return -1; } }
function parsePercent(value: FormDataEntryValue | null) { const parsed = Number(String(value ?? "0").replace(",", ".")); return Number.isFinite(parsed) ? parsed : -1; }
function parseDate(value: FormDataEntryValue | null) { return new Date(`${String(value ?? "")}T00:00:00.000Z`); }
function parseOptionalDate(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text ? parseDate(text) : null; }
