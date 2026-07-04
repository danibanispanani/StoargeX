import type { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/tenant-db";

/**
 * Schreibt einen Audit-Log-Eintrag im Kontext der Organisation.
 * Fehler beim Loggen dürfen die eigentliche Aktion nicht abbrechen.
 */
export async function writeAuditLog(params: {
  organizationId: string;
  userId?: string;
  action: string; // z.B. "member.invite", "sale.create"
  entityType?: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
}): Promise<void> {
  try {
    await tenantDb(params.organizationId).auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before,
        after: params.after,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("[audit] Eintrag konnte nicht geschrieben werden:", error);
  }
}
