"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReturnStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { calcReturnLoss, euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";
import {
  applyReturnWorkflow,
  createRelationalReturn,
  type ReturnWorkflowOperation,
} from "@/lib/services/returns-service";

const optionalEuro = z
  .string()
  .refine((value) => {
    if (!value.trim()) return true;
    try {
      euroToCents(value);
      return true;
    } catch {
      return false;
    }
  }, "Ungültiger Betrag.")
  .transform((value) => (value.trim() ? euroToCents(value) : 0));

const returnSchema = z.object({
  saleId: z.string().min(1, "Bitte einen Verkauf wählen."),
  allocationIds: z.array(z.string().min(1)).min(1, "Bitte mindestens eine Position auswählen."),
  quantities: z.array(z.coerce.number().int().min(1).max(100000)),
  requestedAt: z.string().optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
  problemType: z.string().max(200).optional().or(z.literal("")),
  condition: z.string().max(100).optional().or(z.literal("")),
  refundAmount: optionalEuro,
  extraCost: optionalEuro,
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createReturnAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  const parsed = returnSchema.safeParse({
    saleId: formData.get("saleId"),
    allocationIds: formData.getAll("allocationIds").map(String),
    quantities: formData.getAll("quantities").map(String),
    requestedAt: formData.get("requestedAt"),
    reason: formData.get("reason"),
    problemType: formData.get("problemType"),
    condition: formData.get("condition"),
    refundAmount: formData.get("refundAmount") ?? "",
    extraCost: formData.get("extraCost") ?? "",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;
  if (data.allocationIds.length !== data.quantities.length) {
    return { error: "Zu jeder Retourenposition muss eine Menge angegeben sein." };
  }

  try {
    const created = await createRelationalReturn({
      organizationId: organization.id,
      createdById: userId,
      saleId: data.saleId,
      requestedAt: data.requestedAt ? new Date(data.requestedAt) : new Date(),
      reason: data.reason || null,
      refundAmountCents: data.refundAmount,
      extraCostCents: data.extraCost,
      problemType: data.problemType || data.reason || null,
      condition: data.condition || null,
      notes: data.notes || null,
      selections: data.allocationIds.map((allocationId, index) => ({
        saleLineAllocationId: allocationId,
        quantity: data.quantities[index] ?? 1,
      })),
    });

    revalidateReturnViews();
    return { success: `Retoure ${created.returnRecord.returnNumber ?? ""} erfasst.` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Retoure konnte nicht gespeichert werden.",
    };
  }
}

export async function applyReturnWorkflowAction(
  returnId: string,
  operation: ReturnWorkflowOperation
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  try {
    const ret = await applyReturnWorkflow({
      organizationId: organization.id,
      returnId,
      operation,
      createdById: userId,
    });

    revalidateReturnViews();
    return {
      success:
        operation === "RECEIVE"
          ? `Retoure ${ret.returnNumber ?? ""} in Prüfung gebucht.`
          : operation === "RESTOCK"
            ? `Retoure ${ret.returnNumber ?? ""} wieder verfügbar gebucht.`
            : `Retoure ${ret.returnNumber ?? ""} als defekt gebucht.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Retourenbewegung konnte nicht gebucht werden.",
    };
  }
}

export async function updateReturnStatusAction(
  returnId: string,
  status: ReturnStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(ReturnStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const existing = await db.return.findFirst({
    where: { id: returnId },
    include: { returnLines: { select: { id: true } } },
  });
  if (!existing) return { error: "Retoure nicht gefunden." };

  if (parsed.data === "RESTOCKED" && existing.returnLines.length > 0) {
    return applyReturnWorkflowAction(returnId, "RESTOCK");
  }

  await db.return.update({
    where: { id: returnId },
    data: {
      status: parsed.data,
      restocked: parsed.data === "RESTOCKED" ? true : existing.restocked,
    },
  });

  revalidateReturnViews();
  return { success: "Retoure-Status geändert ✓" };
}

const editReturnSchema = z.object({
  requestedAt: z.string().optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
  refundAmount: optionalEuro,
  extraCost: optionalEuro,
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function updateReturnAction(
  returnId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.return.findFirst({
    where: { id: returnId },
    include: { sale: true },
  });
  if (!existing) return { error: "Retoure nicht gefunden." };

  const parsed = editReturnSchema.safeParse({
    requestedAt: formData.get("requestedAt"),
    reason: formData.get("reason"),
    refundAmount: formData.get("refundAmount") ?? "",
    extraCost: formData.get("extraCost") ?? "",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  const lossCents = calcReturnLoss({
    refundGrossCents: data.refundAmount,
    taxRatePercent: Number(existing.sale.taxRatePercent),
    saleGrossCents: existing.sale.salePriceCents,
    platformFeeCents: existing.sale.platformFeeNetCents,
    paymentFeeCents: 0,
    shippingCostCents: existing.sale.shippingCostCents,
    extraCostCents: data.extraCost,
  });

  await db.return.update({
    where: { id: returnId },
    data: {
      requestedAt: data.requestedAt ? new Date(data.requestedAt) : existing.requestedAt,
      reason: data.reason || null,
      refundAmountCents: data.refundAmount,
      returnShippingCents: data.extraCost,
      lossCents,
      notes: data.notes || null,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "return.update",
    entityType: "Return",
    entityId: returnId,
    before: {
      refundCents: existing.refundAmountCents,
      lossCents: existing.lossCents,
    },
    after: { refundCents: data.refundAmount, lossCents },
  });

  revalidatePath("/retouren");
  return { success: "Retoure gespeichert ✓" };
}

function revalidateReturnViews(): void {
  revalidatePath("/retouren");
  revalidatePath("/verkauf");
  revalidatePath("/lager");
  revalidatePath("/konsignation");
}
