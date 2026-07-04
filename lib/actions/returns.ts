"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReturnStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { calcReturnLoss, euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const optionalEuro = z
  .string()
  .refine((v) => {
    if (!v.trim()) return true;
    try {
      euroToCents(v);
      return true;
    } catch {
      return false;
    }
  }, "Ungültiger Betrag.")
  .transform((v) => (v.trim() ? euroToCents(v) : 0));

const returnSchema = z.object({
  saleId: z.string().min(1, "Bitte einen Verkauf wählen."),
  requestedAt: z.string().optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
  refundAmount: optionalEuro, // Erstattung brutto
  extraCost: optionalEuro, // Zusatzkosten (z.B. Rückversand)
  restock: z.coerce.boolean(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/**
 * Retoure erfassen: harter FK auf den Sale, Verlust wird server-seitig aus
 * den Snapshot-Werten des Verkaufs berechnet (calcReturnLoss). Optionales
 * Wiedereinlagern erhöht den Bestand in derselben Transaktion.
 */
export async function createReturnAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  const parsed = returnSchema.safeParse({
    saleId: formData.get("saleId"),
    requestedAt: formData.get("requestedAt"),
    reason: formData.get("reason"),
    refundAmount: formData.get("refundAmount") ?? "",
    extraCost: formData.get("extraCost") ?? "",
    restock: formData.get("restock") === "on",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;

      const sale = await tx.sale.findFirst({
        where: { id: data.saleId },
        include: { stockItem: true },
      });
      if (!sale) throw new Error("Verkauf nicht gefunden.");

      const lossCents = calcReturnLoss({
        refundGrossCents: data.refundAmount,
        taxRatePercent: Number(sale.taxRatePercent),
        saleGrossCents: sale.salePriceCents,
        platformFeeCents: sale.platformFeeCents,
        paymentFeeCents: sale.paymentFeeCents,
        shippingCostCents: sale.shippingCostCents,
        extraCostCents: data.extraCost,
      });

      const ret = await tx.return.create({
        data: {
          organizationId: organization.id,
          saleId: sale.id,
          requestedAt: data.requestedAt ? new Date(data.requestedAt) : new Date(),
          reason: data.reason || null,
          refundAmountCents: data.refundAmount,
          returnShippingCents: data.extraCost,
          lossCents,
          restocked: data.restock,
          status: data.restock ? "RESTOCKED" : "REQUESTED",
          notes: data.notes || null,
        },
      });

      if (data.refundAmount > 0) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: "REFUNDED" },
        });
      }

      if (data.restock) {
        await tx.stockItem.update({
          where: { id: sale.stockItemId },
          data: {
            quantity: { increment: sale.quantity },
            status: "RETURNED",
          },
        });
      }

      return ret;
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "return.create",
      entityType: "Return",
      entityId: created.id,
      after: {
        saleId: data.saleId,
        refundCents: data.refundAmount,
        lossCents: created.lossCents,
      },
    });

    revalidatePath("/retouren");
    revalidatePath("/verkauf");
    revalidatePath("/lager");
    return { success: "Retoure erfasst." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Retoure konnte nicht gespeichert werden.",
    };
  }
}

/** Status einer Retoure ändern. */
export async function updateReturnStatusAction(
  returnId: string,
  status: ReturnStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(ReturnStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const existing = await db.return.findFirst({ where: { id: returnId } });
  if (!existing) return { error: "Retoure nicht gefunden." };

  await db.return.update({
    where: { id: returnId },
    data: {
      status: parsed.data,
      receivedAt:
        parsed.data === "RECEIVED" && !existing.receivedAt
          ? new Date()
          : existing.receivedAt,
    },
  });

  revalidatePath("/retouren");
  return { success: "Status aktualisiert." };
}
