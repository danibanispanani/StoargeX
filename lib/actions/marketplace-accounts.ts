"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { euroToCents } from "@/lib/calculations";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

const accountSchema = z.object({
  marketplaceCode: z.enum(["EBAY_DE", "KAUFLAND_DE"]),
  displayName: z.string().trim().min(1, "Anzeigename fehlt.").max(100),
  externalAccountId: z.string().trim().max(200).optional(),
  accountType: z.enum(["BUSINESS", "PRIVATE", "MANAGED", "OTHER"]),
  marketplaceCountry: z.string().trim().length(2).default("DE"),
  sellerProfile: z.string().trim().min(1).max(100),
  shopModel: z.string().trim().min(1).max(100),
  taxProfile: z.enum(["PRIVATE", "SMALL_BUSINESS", "VAT_REGISTERED"]),
  standardCondition: z.enum(["NEW", "OPEN_BOX", "REFURBISHED", "USED", "DEFECTIVE"]).nullable(),
  promotedListingsDefault: z.boolean(),
  defaultAdvertisingPercent: z.number().min(0).max(100),
  defaultShippingCostCents: z.number().int().min(0).nullable(),
  defaultPackagingCostCents: z.number().int().min(0).nullable(),
});

export async function saveMarketplaceAccountAction(accountId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");
  const parsed = accountSchema.safeParse({
    marketplaceCode: formData.get("marketplaceCode"),
    displayName: formData.get("displayName"),
    externalAccountId: optionalText(formData.get("externalAccountId")),
    accountType: formData.get("accountType"),
    marketplaceCountry: String(formData.get("marketplaceCountry") || "DE").toUpperCase(),
    sellerProfile: formData.get("sellerProfile"),
    shopModel: formData.get("shopModel"),
    taxProfile: formData.get("taxProfile"),
    standardCondition: optionalText(formData.get("standardCondition")),
    promotedListingsDefault: formData.get("promotedListingsDefault") === "on",
    defaultAdvertisingPercent: parsePercent(formData.get("defaultAdvertisingPercent")),
    defaultShippingCostCents: parseOptionalMoney(formData.get("defaultShippingCost")),
    defaultPackagingCostCents: parseOptionalMoney(formData.get("defaultPackagingCost")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Kontodaten." };
  const data = parsed.data;
  if (data.marketplaceCountry !== "DE") return { error: "In dieser Beta ist für eBay und Kaufland ausschließlich der deutsche Marktplatz freigeschaltet." };
  if (data.marketplaceCode === "EBAY_DE") {
    if (!["COMMERCIAL_ABOVE_STANDARD", "COMMERCIAL_BELOW_STANDARD", "PRIVATE"].includes(data.sellerProfile)) return { error: "Unbekanntes eBay-Verkäuferprofil." };
    if (!["NONE", "BASIC", "TOP", "PREMIUM", "PLATINUM"].includes(data.shopModel)) return { error: "Unbekanntes eBay-Shopmodell." };
  } else if (data.sellerProfile !== "COMMERCIAL" || !["BASIC", "PLUS"].includes(data.shopModel)) {
    return { error: "Kaufland.de unterstützt in dieser Beta nur gewerbliche Basic- und Plus-Konten." };
  }
  if (accountId) {
    const existing = await db.marketplaceAccount.findFirst({ where: { id: accountId }, select: { marketplaceCode: true } });
    if (!existing) return { error: "Marktplatzkonto nicht gefunden." };
    if (existing.marketplaceCode && existing.marketplaceCode !== data.marketplaceCode) return { error: "Der Marktplatz eines bestehenden Kontos kann nicht geändert werden. Lege dafür ein neues Konto an." };
  }
  const marketplaceName = data.marketplaceCode === "EBAY_DE" ? "eBay.de" : "Kaufland.de";
  const platform = await db.platform.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: marketplaceName } },
    create: { organizationId: organization.id, name: marketplaceName, marketplaceCode: data.marketplaceCode },
    update: { marketplaceCode: data.marketplaceCode },
  });
  const schedule = await db.feeSchedule.findFirst({ where: { marketplaceCode: data.marketplaceCode, status: "ACTIVE" }, select: { id: true } });
  const payload = {
    platformId: platform.id,
    marketplaceCode: data.marketplaceCode,
    displayName: data.displayName,
    externalAccountId: data.externalAccountId || null,
    accountType: data.accountType,
    marketplaceCountry: data.marketplaceCountry,
    sellerProfile: data.sellerProfile,
    shopModel: data.shopModel,
    taxProfile: data.taxProfile,
    standardCondition: data.standardCondition,
    promotedListingsDefault: data.promotedListingsDefault,
    defaultAdvertisingPercent: data.defaultAdvertisingPercent.toFixed(4),
    defaultShippingCostCents: data.defaultShippingCostCents,
    defaultPackagingCostCents: data.defaultPackagingCostCents,
    defaultFeeScheduleId: schedule?.id ?? null,
  };
  const account = accountId
    ? await db.marketplaceAccount.update({ where: { id: accountId }, data: payload })
    : await db.marketplaceAccount.create({ data: { organizationId: organization.id, ...payload } });
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: accountId ? "marketplace_account.update" : "marketplace_account.create",
    entityType: "MarketplaceAccount",
    entityId: account.id,
    after: { marketplaceCode: data.marketplaceCode, displayName: data.displayName, shopModel: data.shopModel },
  });
  revalidatePath("/einstellungen/marktplatzkonten");
  revalidatePath("/finanzen/preisrechner/ebay");
  revalidatePath("/finanzen/preisrechner/kaufland");
  return { success: `Marktplatzkonto ${accountId ? "aktualisiert" : "angelegt"} ✓` };
}

export async function toggleMarketplaceAccountAction(accountId: string, active: boolean): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");
  const account = await db.marketplaceAccount.findFirst({ where: { id: accountId } });
  if (!account) return { error: "Marktplatzkonto nicht gefunden." };
  await db.marketplaceAccount.update({ where: { id: account.id }, data: { active } });
  await writeAuditLog({ organizationId: organization.id, userId, action: "marketplace_account.toggle", entityType: "MarketplaceAccount", entityId: account.id, after: { active } });
  revalidatePath("/einstellungen/marktplatzkonten");
  return { success: `Konto ${active ? "aktiviert" : "deaktiviert"} ✓` };
}

function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function parseOptionalMoney(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try { return euroToCents(text); } catch { return -1; }
}
function parsePercent(value: FormDataEntryValue | null) { const parsed = Number(String(value ?? "0").replace(",", ".")); return Number.isFinite(parsed) ? parsed : -1; }
