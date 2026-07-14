"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SaleStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { assertFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { writeAuditLog } from "@/lib/audit";
import {
  calcSale,
  euroToCents,
  feeNetCents,
  resolveTaxRatePercent,
} from "@/lib/calculations";
import { shouldCreateSaleDebt } from "@/lib/services/debt-service";
import type { ActionState } from "@/lib/actions/team";
import {
  cancelInventorySale,
  createInventorySale,
} from "@/lib/services/sales-service";

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

const createSaleSchema = z.object({
  itemRefs: z
    .array(z.string().regex(/^inventory:.+$/))
    .min(1, "Bitte mindestens eine Bestandsposition wählen."),
  itemQuantities: z.array(z.coerce.number().int().min(1).max(100000)),
  platformId: z.string().min(1, "Bitte eine Plattform wählen."),
  marketplaceAccountId: z.string().optional().or(z.literal("")),
  soldAt: z.string().optional().or(z.literal("")),
  saleGross: z.string().min(1, "VK brutto fehlt."),
  buyerCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Land als ISO-2-Kürzel angeben (z.B. DE)."),
  shippingMethod: z.string().max(200).optional().or(z.literal("")),
  shippingCost: optionalEuro,
  platformFeeGross: optionalEuro,
  feeInclVat: z.coerce.boolean(),
  platformFeeNetManual: z.string().optional().or(z.literal("")),
  payoutRecipient: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(["PENDING", "PAID", "SHIPPED", "COMPLETED"]).default("PENDING"),
  invoiceDone: z.coerce.boolean(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const updateSaleSchema = createSaleSchema.omit({
  itemRefs: true,
  itemQuantities: true,
});

function parseMoneyFields(data: {
  saleGross: string;
  platformFeeGross: number;
  feeInclVat: boolean;
  platformFeeNetManual?: string;
}) {
  let saleGrossCents: number;
  try {
    saleGrossCents = euroToCents(data.saleGross);
  } catch {
    return { error: "Ungültiger VK brutto." } as const;
  }

  let platformFeeNetCents: number;
  if (data.platformFeeNetManual?.trim()) {
    try {
      platformFeeNetCents = euroToCents(data.platformFeeNetManual);
    } catch {
      return { error: "Ungültige Plattformgebühren netto." } as const;
    }
  } else {
    platformFeeNetCents = feeNetCents(data.platformFeeGross, data.feeInclVat);
  }

  return { saleGrossCents, platformFeeNetCents } as const;
}

function parseCreateSaleForm(formData: FormData) {
  const parsed = createSaleSchema.safeParse({
    itemRefs: formData.getAll("itemRefs").map(String),
    itemQuantities: formData.getAll("itemQuantities").map(String),
    platformId: formData.get("platformId"),
    marketplaceAccountId: formData.get("marketplaceAccountId"),
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
  if (parsed.data.itemRefs.length !== parsed.data.itemQuantities.length) {
    return { error: "Zu jeder Bestandsposition muss eine Menge angegeben sein." } as const;
  }

  const money = parseMoneyFields(parsed.data);
  if ("error" in money) return money;

  return { data: parsed.data, ...money } as const;
}

function parseUpdateSaleForm(formData: FormData) {
  const parsed = updateSaleSchema.safeParse({
    platformId: formData.get("platformId"),
    marketplaceAccountId: formData.get("marketplaceAccountId"),
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

  const money = parseMoneyFields(parsed.data);
  if ("error" in money) return money;

  return { data: parsed.data, ...money } as const;
}

export async function createSaleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const context = await requireOrg("MEMBER");
  const { db, organization, userId } = context;

  const result = parseCreateSaleForm(formData);
  if (!("data" in result)) return { error: result.error };
  const { data, saleGrossCents, platformFeeNetCents } = result;
  const soldAt = data.soldAt ? new Date(data.soldAt) : new Date();

  const inventoryPositionIds = data.itemRefs.map((ref: string) =>
    ref.slice("inventory:".length)
  );
  const [platform, marketplaceAccount, taxRates, consignmentPosition] = await Promise.all([
    db.platform.findFirst({ where: { id: data.platformId } }),
    data.marketplaceAccountId ? db.marketplaceAccount.findFirst({ where: { id: data.marketplaceAccountId, platformId: data.platformId }, include: { defaultFeeSchedule: true } }) : Promise.resolve(null),
    db.taxRate.findMany({
      select: { country: true, ratePercent: true, isDefault: true },
    }),
    db.inventoryPosition.findFirst({
      where: {
        id: { in: inventoryPositionIds },
        inventoryType: "CONSIGNMENT",
      },
      select: { id: true },
    }),
  ]);
  if (!platform) return { error: "Plattform nicht gefunden." };
  if (data.marketplaceAccountId && !marketplaceAccount) return { error: "Marktplatzkonto passt nicht zur Plattform." };

  if (consignmentPosition) {
    try {
      await assertFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Konsignation ist für diese Organisation nicht aktiviert.",
      };
    }
  }

  const taxRatePercent = resolveTaxRatePercent(
    taxRates.map((rate) => ({
      ...rate,
      ratePercent: Number(rate.ratePercent),
    })),
    data.buyerCountry
  );

  try {
    const created = await createInventorySale({
      organizationId: organization.id,
      createdById: userId,
      platformId: platform.id,
      marketplaceAccountId: marketplaceAccount?.id,
      feeScheduleId: marketplaceAccount?.defaultFeeSchedule?.id,
      marketplaceFeeSnapshot: {
        source: data.platformFeeNetManual?.trim() ? "MANUAL_NET" : "MANUAL_GROSS",
        platformFeeGrossCents: data.platformFeeGross,
        platformFeeNetCents,
        feeInclVat: data.feeInclVat,
        marketplaceAccountId: marketplaceAccount?.id ?? null,
        feeScheduleId: marketplaceAccount?.defaultFeeSchedule?.id ?? null,
        catalogVersion: marketplaceAccount?.defaultFeeSchedule?.version ?? null,
        capturedAt: new Date().toISOString(),
      },
      soldAt,
      selections: data.itemRefs.map((ref: string, index: number) => ({
        inventoryPositionId: ref.slice("inventory:".length),
        quantity: data.itemQuantities[index] ?? 1,
      })),
      saleGrossCents,
      taxRatePercent,
      buyerCountry: data.buyerCountry,
      shippingMethod: data.shippingMethod || null,
      shippingCostCents: data.shippingCost,
      platformFeeGrossCents: data.platformFeeGross,
      platformFeeNetCents,
      feeInclVat: data.feeInclVat,
      payoutRecipient: data.payoutRecipient || null,
      status: data.status,
      invoiceCreated: data.invoiceDone,
      notes: data.notes || null,
      debt: data.payoutRecipient
        ? {
            create: shouldCreateSaleDebt(data.payoutRecipient),
            description: "Verkauf über Inventory-Allocation",
            debtorName: data.payoutRecipient,
            creditorName: "GbR",
          }
        : undefined,
    });

    revalidateSalesViews();
    const debtHint =
      data.payoutRecipient && shouldCreateSaleDebt(data.payoutRecipient)
        ? " · Schulden-Eintrag angelegt"
        : "";
    return {
      success: `Verkauf ${created.sale.orderNumber} gespeichert ✓${debtHint}`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Verkauf konnte nicht gespeichert werden.",
    };
  }
}

export async function updateSaleAction(
  saleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.sale.findFirst({
    where: { id: saleId },
    include: {
      items: true,
      saleLines: {
        include: {
          allocations: true,
        },
      },
    },
  });
  if (!existing) return { error: "Verkauf nicht gefunden." };

  const result = parseUpdateSaleForm(formData);
  if (!("data" in result)) return { error: result.error };
  const { data, saleGrossCents, platformFeeNetCents } = result;

  const [platform, marketplaceAccount] = await Promise.all([
    db.platform.findFirst({ where: { id: data.platformId } }),
    data.marketplaceAccountId ? db.marketplaceAccount.findFirst({ where: { id: data.marketplaceAccountId, platformId: data.platformId }, include: { defaultFeeSchedule: true } }) : Promise.resolve(null),
  ]);
  if (!platform) return { error: "Plattform nicht gefunden." };
  if (data.marketplaceAccountId && !marketplaceAccount) return { error: "Marktplatzkonto passt nicht zur Plattform." };

  const taxRates = await db.taxRate.findMany({
    select: { country: true, ratePercent: true, isDefault: true },
  });
  const taxRatePercent = resolveTaxRatePercent(
    taxRates.map((rate) => ({ ...rate, ratePercent: Number(rate.ratePercent) })),
    data.buyerCountry
  );
  const purchaseNetCents = saleCostNetCents(existing);
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
      marketplaceAccountId: marketplaceAccount?.id ?? null,
      feeScheduleId: marketplaceAccount?.defaultFeeSchedule?.id ?? null,
      marketplaceFeeSnapshot: {
        source: data.platformFeeNetManual?.trim() ? "MANUAL_NET" : "MANUAL_GROSS",
        platformFeeGrossCents: data.platformFeeGross,
        platformFeeNetCents,
        feeInclVat: data.feeInclVat,
        marketplaceAccountId: marketplaceAccount?.id ?? null,
        feeScheduleId: marketplaceAccount?.defaultFeeSchedule?.id ?? null,
        catalogVersion: marketplaceAccount?.defaultFeeSchedule?.version ?? null,
        capturedAt: new Date().toISOString(),
      },
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

export async function cancelSaleAction(saleId: string): Promise<ActionState> {
  const { organization, userId } = await requireOrg("MEMBER");

  try {
    const result = await cancelInventorySale({
      organizationId: organization.id,
      saleId,
      createdById: userId,
    });

    revalidateSalesViews();
    return {
      success: result.alreadyCancelled
        ? `Verkauf ${result.sale.orderNumber ?? ""} war bereits storniert.`
        : `Verkauf ${result.sale.orderNumber ?? ""} storniert und Bestand zurückgeführt.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Verkauf konnte nicht storniert werden.",
    };
  }
}

/** Gesamtstatus ändern (in Bearbeitung / Abgeschlossen). */
export async function updateSaleStatusAction(
  saleId: string,
  status: SaleStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.enum(["PENDING", "COMPLETED", "CANCELLED"]).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const sale = await db.sale.findFirst({ where: { id: saleId } });
  if (!sale) return { error: "Verkauf nicht gefunden." };
  if (sale.status === "CANCELLED") {
    return { error: "Stornierte Verkäufe können hier nicht geändert werden." };
  }
  if (parsed.data === "CANCELLED") {
    return cancelSaleAction(saleId);
  }

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
    success: `Rechnung für ${sale.orderNumber ?? "Verkauf"}: ${
      done ? "Erledigt" : "Offen"
    } ✓`,
  };
}

function saleCostNetCents(sale: {
  items: Array<{ ekNetCents: number }>;
  saleLines: Array<{
    allocations: Array<{ quantity: number; unitCostNetSnapshot: unknown }>;
  }>;
}): number {
  if (sale.saleLines.length > 0) {
    return sale.saleLines.reduce(
      (sum, line) =>
        sum +
        line.allocations.reduce(
          (lineSum, allocation) =>
            lineSum +
            allocation.quantity * Math.round(Number(allocation.unitCostNetSnapshot) * 100),
          0
        ),
      0
    );
  }
  return sale.items.reduce((sum, item) => sum + item.ekNetCents, 0);
}

function revalidateSalesViews(): void {
  revalidatePath("/verkauf");
  revalidatePath("/lager");
  revalidatePath("/konsignation");
  revalidatePath("/schulden");
}
