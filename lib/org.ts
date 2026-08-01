import { auth } from "@/auth";
import { cache } from "react";
import { bypassDb } from "@/lib/prisma";
import { tenantDb, type TenantDb } from "@/lib/tenant-db";
import { hasMinRole } from "@/lib/roles";
import type { Membership, Organization, Role } from "@prisma/client";
import { redirect } from "next/navigation";

export interface OrgContext {
  userId: string;
  organization: Organization;
  membership: Membership;
  /** RLS-gescoppter Prisma-Client – ausschließlich diesen für Geschäftsdaten verwenden. */
  db: TenantDb;
}

type ActiveOrgLookup =
  | { ok: true; context: OrgContext }
  | { ok: false; reason: "unauthenticated" | "no-organization" | "no-membership" };

export const getRequestSession = cache(auth);

/** Autoritative, request-lokale Grundlage für UI, Actions und API-Routen. */
const loadActiveOrgContext = cache(async (): Promise<ActiveOrgLookup> => {
  const session = await getRequestSession();
  if (!session?.user?.id) return { ok: false, reason: "unauthenticated" };
  if (!session.activeOrgId) return { ok: false, reason: "no-organization" };

  const membership = await bypassDb().membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.activeOrgId,
        userId: session.user.id,
      },
    },
    include: { organization: true },
  });
  if (!membership) return { ok: false, reason: "no-membership" };

  return {
    ok: true,
    context: {
      userId: session.user.id,
      organization: membership.organization,
      membership,
      db: tenantDb(membership.organizationId),
    },
  };
});

export async function requireOrg(minRole: Role = "READONLY"): Promise<OrgContext> {
  const access = await loadActiveOrgContext();
  if (!access.ok) {
    if (access.reason === "no-organization") {
      redirect("/registrieren?schritt=organisation");
    }
    redirect("/login");
  }
  if (!hasMinRole(access.context.membership.role, minRole)) {
    throw new Error("Keine Berechtigung für diese Aktion.");
  }
  return access.context;
}

export async function resolveApiOrgContext(
  minRole: Role = "READONLY"
): Promise<{ ok: true; context: OrgContext } | { ok: false; status: 401 | 403 }> {
  const access = await loadActiveOrgContext();
  if (!access.ok) {
    return { ok: false, status: access.reason === "no-membership" ? 403 : 401 };
  }
  if (!hasMinRole(access.context.membership.role, minRole)) {
    return { ok: false, status: 403 };
  }
  return { ok: true, context: access.context };
}
