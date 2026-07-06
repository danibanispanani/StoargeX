"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SaleStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  calcPurchaseNetCents,
  calcSale,
  euroToCents,
  feeNetCents,
  formatOrderId,
  resolveTaxRatePercent,
} from "@/lib/calculations";
import { paymentMethodCreatesDebt } from "@/lib/constants";
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

const saleSchema = z.object({
  // Positionen: "stock:<id>" oder "consignment:<id>"
  itemRefs: z.array(z.string().regex(/^(stock|consignment):.+$/)).min(1, "Bitte mindestens einen Artikel wählen."),
  platformId: z.string().min(1, "Bitte eine Plattform wählen."),
  soldAt: z.string().optional().or(z.literal("")),
  saleGross: z.string().min(1, "VK brutto fehlt."),
  buyerCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Land als ISO-2-Kürzel angeben (z.B. DE)."),
  shippingMethod: z.string().max(200).optional().or(z.literal("")),
  shippingCost: optionalEuro, // Versand netto (aus Tarif vorbefüllt, überschreibbar)
  platformFeeGross: optionalEuro,
  feeInclVat: z.coerce.boolean(),
  platformFeeNetManual: z.string().optional().or(z.literal("")), // manuelles Netto (optional)
  payoutRecipient: z.string().max(200).optional().or(z.literal("")),
  status: z.nativeEnum(SaleStatus).default("PENDING"),
  invoiceDone: z.coerce.boolean(),
  notes: z.string().max(2000).optional().or(z.literal("")), // Kommentar
});

function parseSaleForm(formData: FormData) {
  const parsed = saleSchema.safeParse({
    itemRefs: formData.getAll("itemRefs").map(String),
    platformId: formData.get("platformId"),
    soldAt: formData.get("soldAt"),
    saleGross: formData.get("saleGross"),
    buyerCountry: formData.get("buyerCountry"),
    shippingMethod: formData.get("shippingMethod"),
    shippingCost: formData.get("shippingCost") ?? "",
    platformFeeGross: formData.get("platformFeeGross") ?? "",
    feeInclVat: formData.get("feeInclVat") === "on",
    platformFeeNetManual: formData.get("platformFeeNetManual"),
    payoutRecipient: formData.get("payoutRecipient"),
    status: formData.get("status") || "PENDING",
    invoiceDone: formData.get("invoiceDone") === "on",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }

  let saleGrossCents: number;
  try {
    saleGrossCents = euroToCents(parsed.data.saleGross);
  } catch {
    return { error: "Ungültiger VK brutto." } as const;
  }

  // Plattformgebühren netto: manuell überschrieben oder berechnet
  let platformFeeNetCents: number;
  if (parsed.data.platformFeeNetManual?.trim()) {
    try {
      platformFeeNetCents = euroToCents(parsed.data.platformFeeNetManual);
    } catch {
      return { error: "Ungültige Plattformgebühren netto." } as const;
    }
  } else {
    platformFeeNetCents = feeNetCents(parsed.data.platformFeeGross, parsed.data.feeInclVat);
  }

  return { data: parsed.data, saleGrossCents, platformFeeNetCents } as const;
}

interface ResolvedItems {
  stockIds: string[];
  consignmentIds: string[];
}

function splitItemRefs(refs: string[]): ResolvedItems {
  return {
    stockIds: refs.filter((r) => r.startsWith("stock:")).map((r) => r.slice(6)),
    consignmentIds: refs
      .filter((r) => r.startsWith("consignment:"))
      .map((r) => r.slice(12)),
  };
}

/**
 * Verkauf erfassen: ein oder mehrere Artikel aus Lager und/oder Konsignation.
 * EK netto = Summe aller Positionen, Steuern/Netto/Marge/Gewinn werden
 * server-seitig berechnet, Bestand und Order-ID atomar aktualisiert.
 */
export async function createSaleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  const result = parseSaleForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, saleGrossCents, platformFeeNetCents } = result;
  const { stockIds, consignmentIds } = splitItemRefs(data.itemRefs);
  const soldAt = data.soldAt ? new Date(data.soldAt) : new Date();

  try {
    const sale = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;

      const [stockItems, consignments, platform, taxRates] = await Promise.all([
        stockIds.length
          ? tx.stockItem.findMany({ where: { id: { in: stockIds } } })
          : Promise.resolve([]),
        consignmentIds.length
          ? tx.consignmentInventory.findMany({ where: { id: { in: consignmentIds } } })
          : Promise.resolve([]),
        tx.platform.findFirst({ where: { id: data.platformId } }),
        tx.taxRate.findMany({
          select: { country: true, ratePercent: true, isDefault: true },
        }),
      ]);

      if (stockItems.length !== stockIds.length || consignments.length !== consignmentIds.length) {
        throw new Error("Mindestens ein gewählter Artikel ist ungültig.");
      }
      if (!platform) throw new Error("Plattform nicht gefunden.");

      const soldStock = stockItems.find((i) => i.status === "SOLD");
      if (soldStock) throw new Error(`${soldStock.sku} ist bereits verkauft.`);
      const emptyConsignment = consignments.find((c) => c.quantity < 1);
      if (emptyConsignment) {
        throw new Error(`Konsignation ${emptyConsignment.sku} hat keinen Bestand mehr.`);
      }

      const taxRatePercent = resolveTaxRatePercent(
        taxRates.map((r) => ({ ...r, ratePercent: Number(r.ratePercent) })),
        data.buyerCountry
      );

      // EK netto: Lager = EK-Netto-Snapshot; Konsignation = vereinbarte Auszahlung
      const itemLines = [
        ...stockItems.map((item) => ({
          stockItemId: item.id,
          consignmentId: null as string | null,
          ekNetCents:
            item.purchaseNetCents ??
            calcPurchaseNetCents(item.purchasePriceCents, item.inputTaxDeductible, 19),
        })),
        ...consignments.map((c) => ({
          stockItemId: null as string | null,
          consignmentId: c.id,
          ekNetCents: c.agreedPayoutCents ?? 0,
        })),
      ];
      const purchaseNetCents = itemLines.reduce((sum, l) => sum + l.ekNetCents, 0);

      const calc = calcSale({
        saleGrossCents,
        taxRatePercent,
        purchaseNetCents,
        shippingCostCents: data.shippingCost,
        platformFeeCents: platformFeeNetCents, // Gewinn rechnet mit Netto-Gebühren
        paymentFeeCents: 0,
      });

      const org = await tx.organization.update({
        where: { id: organization.id },
        data: { orderIdCounter: { increment: 1 } },
      });
      const orderNumber = formatOrderId(org.orderIdFormat, org.orderIdCounter, soldAt);

      const created = await tx.sale.create({
        data: {
          organizationId: organization.id,
          platformId: platform.id,
          soldAt,
          quantity: itemLines.length,
          salePriceCents: saleGrossCents,
          saleNetCents: calc.saleNetCents,
          taxRatePercent,
          marginCents: calc.marginCents,
          profitCents: calc.profitCents,
          buyerCountry: data.buyerCountry,
          shippingMethod: data.shippingMethod || null,
          shippingCostCents: data.shippingCost,
          platformFeeCents: data.platformFeeGross,
          platformFeeNetCents,
          feeInclVat: data.feeInclVat,
          payoutRecipient: data.payoutRecipient || null,
          status: data.status,
          invoiceCreated: data.invoiceDone,
          notes: data.notes || null,
          orderNumber,
          items: {
            create: itemLines.map((line) => ({
              organizationId: organization.id,
              stockItemId: line.stockItemId,
              consignmentId: line.consignmentId,
              ekNetCents: line.ekNetCents,
            })),
          },
        },
      });

      // Bestände aktualisieren
      if (stockIds.length > 0) {
        await tx.stockItem.updateMany({
          where: { id: { in: stockIds } },
          data: { status: "SOLD", quantity: 0 },
        });
      }
      for (const c of consignments) {
        await tx.consignmentInventory.update({
          where: { id: c.id },
          data: {
            quantity: c.quantity - 1,
            soldQuantity: c.soldQuantity + 1,
            linkedSaleIds: { push: created.id },
          },
        });
      }

      // Automatik: Auszahlung an Richard/Daniel (nicht "Firma…") ->
      // Schulden-Eintrag: Person schuldet der GbR den VK brutto
      if (data.payoutRecipient && paymentMethodCreatesDebt(data.payoutRecipient)) {
        const description = [
          ...stockItems.map((i) => [i.title, i.variant].filter(Boolean).join(" ")),
          ...consignments.map((c) => c.itemTitle),
        ].join(", ");
        await tx.debt.create({
          data: {
            organizationId: organization.id,
            debtDate: soldAt,
            refId: orderNumber,
            description,
            kind: "VERKAUF",
            quantity: itemLines.length,
            amountCents: saleGrossCents,
            debtorName: data.payoutRecipient,
            creditorName: "GbR",
            status: "OPEN",
            entryStatus: "IO",
          },
        });
      }

      return created;
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "sale.create",
      entityType: "Sale",
      entityId: sale.id,
      after: { orderNumber: sale.orderNumber, saleGrossCents, items: data.itemRefs.length },
    });

    revalidatePath("/verkauf");
    revalidatePath("/lager");
    revalidatePath("/konsignation");
    revalidatePath("/schulden");
    const debtHint =
      data.payoutRecipient && paymentMethodCreatesDebt(data.payoutRecipient)
        ? " · Schulden-Eintrag angelegt"
        : "";
    return { success: `Verkauf ${sale.orderNumber} gespeichert ✓${debtHint}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Verkauf konnte nicht gespeichert werden.",
    };
  }
}

/**
 * Verkauf nachträglich bearbeiten (Beträge, Status, Plattform, Versand …).
 * Die Positionen bleiben bestehen; Berechnungen werden aktualisiert.
 */
export async function updateSaleAction(
  saleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.sale.findFirst({
    where: { id: saleId },
    include: { items: true },
  });
  if (!existing) return { error: "Verkauf nicht gefunden." };

  // Beim Bearbeiten sind die Positionen fix – itemRefs aus DB übernehmen
  const refs = existing.items.map((i) =>
    i.stockItemId ? `stock:${i.stockItemId}` : `consignment:${i.consignmentId}`
  );
  for (const ref of refs) formData.append("itemRefs", ref);

  const result = parseSaleForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, saleGrossCents, platformFeeNetCents } = result;

  const platform = await db.platform.findFirst({ where: { id: data.platformId } });
  if (!platform) return { error: "Plattform nicht gefunden." };

  const taxRates = await db.taxRate.findMany({
    select: { country: true, ratePercent: true, isDefault: true },
  });
  const taxRatePercent = resolveTaxRatePercent(
    taxRates.map((r) => ({ ...r, ratePercent: Number(r.ratePercent) })),
    data.buyerCountry
  );
  const purchaseNetCents = existing.items.reduce((sum, i) => sum + i.ekNetCents, 0);

  const calc = calcSale({
    saleGrossCents,
    taxRatePercent,
    purchaseNetCents,
    shippingCostCents: data.shippingCost,
    platformFeeCents: platformFeeNetCents,
    paymentFeeCents: 0,
  });

  await db.sale.update({
    where: { id: saleId },
    data: {
      platformId: platform.id,
      soldAt: data.soldAt ? new Date(data.soldAt) : existing.soldAt,
      salePriceCents: saleGrossCents,
      saleNetCents: calc.saleNetCents,
      taxRatePercent,
      marginCents: calc.marginCents,
      profitCents: calc.profitCents,
      buyerCountry: data.buyerCountry,
      shippingMethod: data.shippingMethod || null,
      shippingCostCents: data.shippingCost,
      platformFeeCents: data.platformFeeGross,
      platformFeeNetCents,
      feeInclVat: data.feeInclVat,
      payoutRecipient: data.payoutRecipient || null,
      status: data.status,
      invoiceCreated: data.invoiceDone,
      notes: data.notes || null,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "sale.update",
    entityType: "Sale",
    entityId: saleId,
    before: { salePriceCents: existing.salePriceCents, status: existing.status },
    after: { salePriceCents: saleGrossCents, status: data.status },
  });

  revalidatePath("/verkauf");
  return { success: `Verkauf ${existing.orderNumber ?? ""} gespeichert ✓` };
}

/** Gesamtstatus ändern (in Bearbeitung / Abgeschlossen). */
export async function updateSaleStatusAction(
  saleId: string,
  status: SaleStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.enum(["PENDING", "COMPLETED"]).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const sale = await db.sale.findFirst({ where: { id: saleId } });
  if (!sale) return { error: "Verkauf nicht gefunden." };

  await db.sale.update({
    where: { id: saleId },
    data: { status: parsed.data },
  });

  revalidatePath("/verkauf");
  return { success: `Status von ${sale.orderNumber ?? "Verkauf"} geändert ✓` };
}

/** Rechnungs-Status ändern (Erledigt / Offen). */
export async function updateInvoiceStatusAction(
  saleId: string,
  done: boolean
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const sale = await db.sale.findFirst({ where: { id: saleId } });
  if (!sale) return { error: "Verkauf nicht gefunden." };

  await db.sale.update({
    where: { id: saleId },
    data: { invoiceCreated: Boolean(done) },
  });

  revalidatePath("/verkauf");
  return {
    success: `Rechnung für ${sale.orderNumber ?? "Verkauf"}: ${done ? "Erledigt" : "Offen"} ✓`,
  };
}
