"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  calcPurchaseNetCents,
  calcSale,
  euroToCents,
  formatOrderId,
  resolveTaxRatePercent,
} from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const euroString = z
  .string()
  .min(1, "Betrag fehlt.")
  .refine((v) => {
    try {
      euroToCents(v);
      return true;
    } catch {
      return false;
    }
  }, "Ungültiger Betrag.");

const optionalEuroString = z
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

const saleSchema = z.object({
  stockItemId: z.string().min(1, "Bitte einen Artikel wählen."),
  platformId: z.string().min(1, "Bitte eine Plattform wählen."),
  soldAt: z.string().optional().or(z.literal("")),
  saleGross: euroString,
  buyerCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Käuferland als ISO-2-Kürzel angeben (z.B. DE)."),
  shippingMethod: z.string().max(200).optional().or(z.literal("")),
  shippingCost: optionalEuroString,
  shippingCharged: optionalEuroString,
  platformFee: optionalEuroString,
  paymentFee: optionalEuroString,
  payoutRecipient: z.string().max(200).optional().or(z.literal("")),
  buyerUsername: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/**
 * Verkauf erfassen: reduziert den Lagerbestand, berechnet server-seitig
 * VK netto (USt-Satz je Käuferland), Marge und Gewinn und vergibt eine
 * lesbare Order-ID nach konfigurierbarem Format – alles in EINER Transaktion
 * mit gesetztem RLS-Tenant-Kontext.
 */
export async function createSaleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  const parsed = saleSchema.safeParse({
    stockItemId: formData.get("stockItemId"),
    platformId: formData.get("platformId"),
    soldAt: formData.get("soldAt"),
    saleGross: formData.get("saleGross"),
    buyerCountry: formData.get("buyerCountry"),
    shippingMethod: formData.get("shippingMethod"),
    shippingCost: formData.get("shippingCost") ?? "",
    shippingCharged: formData.get("shippingCharged") ?? "",
    platformFee: formData.get("platformFee") ?? "",
    paymentFee: formData.get("paymentFee") ?? "",
    payoutRecipient: formData.get("payoutRecipient"),
    buyerUsername: formData.get("buyerUsername"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;
  const saleGrossCents = euroToCents(data.saleGross);
  const soldAt = data.soldAt ? new Date(data.soldAt) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // RLS-Tenant-Kontext für die gesamte Transaktion setzen
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;

      const item = await tx.stockItem.findFirst({
        where: { id: data.stockItemId },
      });
      if (!item) throw new Error("Artikel nicht gefunden.");
      if (item.quantity < 1 || item.status === "SOLD") {
        throw new Error("Artikel ist nicht mehr auf Lager.");
      }

      const platform = await tx.platform.findFirst({
        where: { id: data.platformId },
      });
      if (!platform) throw new Error("Plattform nicht gefunden.");

      // USt-Satz des Käuferlands (Stammdaten in den Einstellungen editierbar)
      const taxRates = await tx.taxRate.findMany({
        select: { country: true, ratePercent: true, isDefault: true },
      });
      const taxRatePercent = resolveTaxRatePercent(
        taxRates.map((r) => ({ ...r, ratePercent: Number(r.ratePercent) })),
        data.buyerCountry
      );

      // EK netto aus dem Artikel (Fallback: aus Brutto ableiten)
      const purchaseNetCents =
        item.purchaseNetCents ??
        calcPurchaseNetCents(item.purchasePriceCents, item.inputTaxDeductible, 19);

      const calc = calcSale({
        saleGrossCents,
        taxRatePercent,
        purchaseNetCents,
        shippingCostCents: data.shippingCost,
        platformFeeCents: data.platformFee,
        paymentFeeCents: data.paymentFee,
      });

      // Lesbare Order-ID: Zähler atomar erhöhen, Format aus den Einstellungen
      const org = await tx.organization.update({
        where: { id: organization.id },
        data: { orderIdCounter: { increment: 1 } },
      });
      const orderNumber = formatOrderId(org.orderIdFormat, org.orderIdCounter, soldAt);

      const sale = await tx.sale.create({
        data: {
          organizationId: organization.id,
          stockItemId: item.id,
          platformId: platform.id,
          soldAt,
          quantity: 1,
          salePriceCents: saleGrossCents,
          saleNetCents: calc.saleNetCents,
          taxRatePercent,
          marginCents: calc.marginCents,
          profitCents: calc.profitCents,
          buyerCountry: data.buyerCountry,
          shippingMethod: data.shippingMethod || null,
          payoutRecipient: data.payoutRecipient || null,
          shippingCostCents: data.shippingCost,
          shippingChargedCents: data.shippingCharged,
          platformFeeCents: data.platformFee,
          paymentFeeCents: data.paymentFee,
          buyerUsername: data.buyerUsername || null,
          notes: data.notes || null,
          orderNumber,
          status: "PAID",
        },
      });

      // Lagerbestand automatisch reduzieren
      const newQuantity = item.quantity - 1;
      await tx.stockItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          status: newQuantity <= 0 ? "SOLD" : item.status,
        },
      });

      return sale;
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "sale.create",
      entityType: "Sale",
      entityId: result.id,
      after: {
        orderNumber: result.orderNumber,
        saleGrossCents,
        profitCents: result.profitCents,
      },
    });

    revalidatePath("/verkauf");
    revalidatePath("/lager");
    return { success: `Verkauf ${result.orderNumber} erfasst.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Verkauf konnte nicht gespeichert werden.",
    };
  }
}

const FLAG_FIELDS = ["invoiceCreated", "postageBooked", "feesBooked"] as const;
export type SaleFlagField = (typeof FLAG_FIELDS)[number];

/** Informative Checkbox-Status (Rechnung erstellt / Porto gebucht / Gebühren gebucht). */
export async function toggleSaleFlagAction(
  saleId: string,
  field: SaleFlagField,
  value: boolean
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  if (!FLAG_FIELDS.includes(field)) return { error: "Ungültiges Feld." };

  const sale = await db.sale.findFirst({ where: { id: saleId } });
  if (!sale) return { error: "Verkauf nicht gefunden." };

  await db.sale.update({
    where: { id: saleId },
    data: { [field]: Boolean(value) },
  });

  revalidatePath("/verkauf");
  return { success: "Gespeichert." };
}
