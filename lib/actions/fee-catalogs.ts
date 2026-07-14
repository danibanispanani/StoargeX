"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getBundledFeeCatalog } from "@/lib/services/fee-catalog-service";
import { activateFeeCatalog, persistNormalizedFeeCatalog } from "@/lib/services/fee-catalog-persistence-service";
import type { ActionState } from "@/lib/actions/team";

const marketplaceSchema = z.enum(["EBAY_DE", "KAUFLAND_DE"]);

export async function importBundledFeeCatalogAction(marketplaceCode: string): Promise<ActionState> {
  const { organization, userId } = await requireOrg("ADMIN");
  const parsed = marketplaceSchema.safeParse(marketplaceCode);
  if (!parsed.success) return { error: "Unbekannter Startkatalog." };
  const catalog = getBundledFeeCatalog(parsed.data);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    return persistNormalizedFeeCatalog({ tx, organizationId: organization.id, createdById: userId, catalog });
  }, { timeout: 120_000 });
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "fee_catalog.import",
    entityType: "FeeSchedule",
    entityId: result.feeScheduleId,
    after: { marketplaceCode: parsed.data, sourceHash: catalog.sourceHash, imported: result.imported },
  });
  revalidatePath("/finanzen/gebuehren");
  return { success: result.imported ? "Katalog als Entwurf importiert ✓" : "Diese Katalogversion ist bereits vorhanden." };
}

export async function activateFeeCatalogAction(feeScheduleId: string): Promise<ActionState> {
  const { organization, userId } = await requireOrg("ADMIN");
  const marketplaceCode = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:fee-catalog:${organization.id}`}))`;
    return activateFeeCatalog({ tx, organizationId: organization.id, feeScheduleId });
  });
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "fee_catalog.activate",
    entityType: "FeeSchedule",
    entityId: feeScheduleId,
    after: { marketplaceCode },
  });
  revalidatePath("/finanzen/gebuehren");
  revalidatePath("/finanzen/preisrechner/ebay");
  revalidatePath("/finanzen/preisrechner/kaufland");
  revalidatePath("/produkte");
  return { success: "Katalog aktiviert; ältere Produkt-Snapshots wurden als veraltet markiert ✓" };
}

export async function archiveFeeCatalogAction(feeScheduleId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");
  const schedule = await db.feeSchedule.findFirst({
    where: { id: feeScheduleId },
    select: { id: true, marketplaceCode: true, status: true },
  });
  if (!schedule) return { error: "Katalog nicht gefunden." };
  if (schedule.status === "ARCHIVED") return { success: "Katalog ist bereits archiviert." };
  if (schedule.status === "ACTIVE") return { error: "Ein aktiver Katalog wird durch die Aktivierung seiner Nachfolgeversion archiviert und kann nicht direkt archiviert werden." };
  await db.feeSchedule.update({ where: { id: schedule.id }, data: { status: "ARCHIVED" } });
  await db.marketplacePricingCalculation.updateMany({
    where: { feeScheduleId: schedule.id },
    data: { stale: true },
  });
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "fee_catalog.archive",
    entityType: "FeeSchedule",
    entityId: schedule.id,
    before: { status: schedule.status },
    after: { status: "ARCHIVED", marketplaceCode: schedule.marketplaceCode },
  });
  revalidatePath("/finanzen/gebuehren");
  revalidatePath("/produkte");
  return { success: "Katalog archiviert; historische Referenzen bleiben erhalten ✓" };
}
