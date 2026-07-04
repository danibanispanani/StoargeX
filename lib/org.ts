import { auth } from "@/auth";
import { bypassDb } from "@/lib/prisma";
import { tenantDb, type TenantDb } from "@/lib/tenant-db";
import { hasMinRole } from "@/lib/roles";
import type { Membership, Organization, Role } from "@prisma/client";
import { redirect } from "next/navigation";

export interface OrgContext {
  userId: string;
  organization: Organization;
  membership: Membership;
  /** RLS-gescoppter Prisma-Client – ausschließlich diesen für Geschäftsdaten verwenden! */
  db: TenantDb;
}

/**
 * Autoritative Prüfung pro Request (zusätzlich zur Middleware):
 * eingeloggt + Mitgliedschaft frisch aus der DB + optionale Mindestrolle.
 * Liefert den RLS-gescoppten Tenant-Client für die aktive Organisation.
 */
export async function requireOrg(minRole: Role = "READONLY"): Promise<OrgContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.activeOrgId) redirect("/registrieren?schritt=organisation");

  const membership = await bypassDb().membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.activeOrgId,
        userId: session.user.id,
      },
    },
    include: { organization: true },
  });
  if (!membership) redirect("/login");
  if (!hasMinRole(membership.role, minRole)) {
    throw new Error("Keine Berechtigung für diese Aktion.");
  }

  return {
    userId: session.user.id,
    organization: membership.organization,
    membership,
    db: tenantDb(membership.organizationId),
  };
}
