import { auth } from "@/auth";
import { cache } from "react";
import { bypassDb } from "@/lib/prisma";
import { tenantDb, type TenantDb } from "@/lib/tenant-db";
import { hasMinRole } from "@/lib/roles";
import type { Membership, Organization, Role } from "@prisma/client";
import { redirect } from "next/navigation";

interface OrgPerformanceRecorder {
  record(name: string, durationMs: number): void;
}

interface OrgLookupTimings {
  authMs: number;
  membershipMs: number;
  totalMs: number;
}

export interface OrgContext {
  userId: string;
  organization: Organization;
  membership: Membership;
  /** RLS-gescoppter Prisma-Client – ausschließlich diesen für Geschäftsdaten verwenden. */
  db: TenantDb;
}

type ActiveOrgLookup =
  | { ok: true; context: OrgContext; timings: OrgLookupTimings }
  | {
      ok: false;
      reason: "unauthenticated" | "no-organization" | "no-membership";
      timings: OrgLookupTimings;
    };

export const getRequestSession = cache(auth);

/** Autoritative, request-lokale Grundlage für UI, Actions und API-Routen. */
const loadActiveOrgContext = cache(async (): Promise<ActiveOrgLookup> => {
  const totalStartedAt = performance.now();
  const authStartedAt = performance.now();
  const session = await getRequestSession();
  const authMs = performance.now() - authStartedAt;
  const emptyMembershipTiming = () => ({
    authMs,
    membershipMs: 0,
    totalMs: performance.now() - totalStartedAt,
  });
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthenticated", timings: emptyMembershipTiming() };
  }
  if (!session.activeOrgId) {
    return { ok: false, reason: "no-organization", timings: emptyMembershipTiming() };
  }

  const membershipStartedAt = performance.now();
  const membership = await bypassDb().membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.activeOrgId,
        userId: session.user.id,
      },
    },
    include: { organization: true },
  });
  const membershipMs = performance.now() - membershipStartedAt;
  const timings = {
    authMs,
    membershipMs,
    totalMs: performance.now() - totalStartedAt,
  };
  if (!membership) return { ok: false, reason: "no-membership", timings };

  return {
    ok: true,
    context: {
      userId: session.user.id,
      organization: membership.organization,
      membership,
      db: tenantDb(membership.organizationId),
    },
    timings,
  };
});

export async function requireOrg(
  minRole: Role = "READONLY",
  performanceTrace?: OrgPerformanceRecorder
): Promise<OrgContext> {
  const requireStartedAt = performance.now();
  const access = await loadActiveOrgContext();
  performanceTrace?.record("require_org.auth", access.timings.authMs);
  performanceTrace?.record("require_org.membership", access.timings.membershipMs);
  performanceTrace?.record("require_org.lookup", access.timings.totalMs);
  performanceTrace?.record("require_org.call", performance.now() - requireStartedAt);
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
