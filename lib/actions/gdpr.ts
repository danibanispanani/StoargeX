"use server";

import { rm } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { signOut } from "@/auth";
import type { ActionState } from "@/lib/actions/team";

// DSGVO Art. 15 (Auskunft) / Art. 20 (Datenübertragbarkeit):
// vollständiger Export aller Organisationsdaten als JSON.
// DSGVO Art. 17 (Löschung): vollständige Löschung der Organisation inkl.
// aller Geschäftsdaten (DB-Kaskaden) und hochgeladener Bilder.
// Beides nur für OWNER; jede Ausführung wird protokolliert.

export type ExportResult = { json: string; filename: string } | { error: string };

/** Alle Daten der Organisation als JSON exportieren (nur OWNER). */
export async function exportOrganizationDataAction(): Promise<ExportResult> {
  const { db, organization, userId } = await requireOrg("OWNER");

  const [
    memberships,
    invitations,
    platforms,
    carriers,
    taxRates,
    shippingRates,
    stockItems,
    listings,
    sales,
    returns,
    consignments,
    debts,
    tasks,
    credentials,
    auditLogs,
  ] = await Promise.all([
    db.membership.findMany({
      include: { user: { select: { email: true, name: true } } },
    }),
    db.invitation.findMany(),
    db.platform.findMany(),
    db.carrier.findMany(),
    db.taxRate.findMany(),
    db.shippingRate.findMany(),
    db.stockItem.findMany(),
    db.stockItemListing.findMany(),
    db.sale.findMany(),
    db.return.findMany(),
    db.consignmentInventory.findMany(),
    db.debt.findMany(),
    db.task.findMany(),
    // Secrets bleiben verschlüsselt – der Export enthält KEINE Klartext-Secrets
    db.credential.findMany({
      select: {
        id: true,
        label: true,
        username: true,
        platformId: true,
        notes: true,
        lastRotatedAt: true,
        createdAt: true,
      },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const h = await headers();
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "organization.export",
    entityType: "Organization",
    entityId: organization.id,
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "storagex-export-v1",
    organization,
    memberships,
    invitations,
    platforms,
    carriers,
    taxRates,
    shippingRates,
    stockItems,
    stockItemListings: listings,
    sales,
    returns,
    consignmentInventory: consignments,
    debts,
    tasks,
    credentials, // ohne Secrets
    auditLogs,
  };

  const date = new Date().toISOString().slice(0, 10);
  return {
    json: JSON.stringify(payload, null, 2),
    filename: `storagex-export-${organization.slug}-${date}.json`,
  };
}

const deleteSchema = z.object({
  confirmName: z.string().min(1, "Bitte den Organisationsnamen eingeben."),
});

/**
 * Organisation vollständig löschen (nur OWNER, Name muss exakt bestätigt
 * werden). DB-Kaskaden entfernen alle Geschäftsdaten; Bild-Uploads werden
 * vom Dateisystem gelöscht. Danach Abmeldung.
 */
export async function deleteOrganizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("OWNER");

  const parsed = deleteSchema.safeParse({
    confirmName: formData.get("confirmName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  if (parsed.data.confirmName.trim() !== organization.name) {
    return {
      error: `Bestätigung stimmt nicht. Bitte exakt "${organization.name}" eingeben.`,
    };
  }

  // Letzter Audit-Eintrag vor der Löschung (verschwindet mit der Kaskade –
  // deshalb zusätzlich ins Server-Log)
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "organization.delete",
    entityType: "Organization",
    entityId: organization.id,
    before: { name: organization.name },
  });
  console.warn(
    `[DSGVO] Organisation "${organization.name}" (${organization.id}) wird auf Anforderung von User ${userId} vollständig gelöscht.`
  );

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    await tx.organization.delete({ where: { id: organization.id } });
  });

  // Hochgeladene Bilder entfernen
  await rm(path.join(process.cwd(), "public", "uploads", organization.id), {
    recursive: true,
    force: true,
  });

  await signOut({ redirect: false });
  redirect("/?geloescht=1");
}
