import type { Role } from "@prisma/client";
import type { SessionMembership } from "@/types/next-auth";
import { hasMinRole } from "@/lib/roles";

export const READ_ORG_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

export interface ReadOrgSnapshot {
  userId: string;
  orgId: string;
  role: Role;
  issuedAtMs: number;
  expiresAtMs: number;
}

export function createReadOrgSnapshot(params: {
  userId: string | null | undefined;
  activeOrgId: string | null | undefined;
  memberships: SessionMembership[] | null | undefined;
  now?: Date;
}): ReadOrgSnapshot | null {
  if (!params.userId || !params.activeOrgId) return null;
  const activeMembership = params.memberships?.find(
    (membership) => membership.orgId === params.activeOrgId
  );
  if (!activeMembership) return null;

  const issuedAtMs = (params.now ?? new Date()).getTime();
  return {
    userId: params.userId,
    orgId: activeMembership.orgId,
    role: activeMembership.role,
    issuedAtMs,
    expiresAtMs: issuedAtMs + READ_ORG_SNAPSHOT_MAX_AGE_MS,
  };
}

export function isReadOrgSnapshotUsable(
  snapshot: ReadOrgSnapshot | null | undefined,
  params: {
    userId: string | null | undefined;
    activeOrgId: string | null | undefined;
    minRole: Role;
    now?: Date;
  }
): snapshot is ReadOrgSnapshot {
  if (!snapshot || !params.userId || !params.activeOrgId) return false;
  if (snapshot.userId !== params.userId) return false;
  if (snapshot.orgId !== params.activeOrgId) return false;
  if (!Number.isFinite(snapshot.issuedAtMs) || !Number.isFinite(snapshot.expiresAtMs)) {
    return false;
  }
  if (snapshot.expiresAtMs - snapshot.issuedAtMs > READ_ORG_SNAPSHOT_MAX_AGE_MS) {
    return false;
  }
  if ((params.now ?? new Date()).getTime() >= snapshot.expiresAtMs) return false;
  return hasMinRole(snapshot.role, params.minRole);
}
