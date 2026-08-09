import { describe, expect, it } from "vitest";
import {
  READ_ORG_SNAPSHOT_MAX_AGE_MS,
  createReadOrgSnapshot,
  isReadOrgSnapshotUsable,
} from "@/lib/read-org-snapshot";
import type { SessionMembership } from "@/types/next-auth";

const memberships: SessionMembership[] = [
  {
    orgId: "org-a",
    orgName: "Org A",
    orgSlug: "org-a",
    role: "MEMBER",
    tier: "PRO",
  },
  {
    orgId: "org-b",
    orgName: "Org B",
    orgSlug: "org-b",
    role: "READONLY",
    tier: "FREE",
  },
];

describe("read org snapshot", () => {
  it("bindet Login-Snapshots an die aktive serverseitige Mitgliedschaft", () => {
    const snapshot = createReadOrgSnapshot({
      userId: "user-a",
      activeOrgId: "org-a",
      memberships,
      now: new Date(1000),
    });

    expect(snapshot).toEqual({
      userId: "user-a",
      orgId: "org-a",
      role: "MEMBER",
      issuedAtMs: 1000,
      expiresAtMs: 1000 + READ_ORG_SNAPSHOT_MAX_AGE_MS,
    });
  });

  it("aktualisiert den Snapshot beim Organisationswechsel auf die neue Rolle", () => {
    const snapshot = createReadOrgSnapshot({
      userId: "user-a",
      activeOrgId: "org-b",
      memberships,
      now: new Date(2000),
    });

    expect(snapshot?.orgId).toBe("org-b");
    expect(snapshot?.role).toBe("READONLY");
  });

  it("verwirft Snapshots fuer fremde oder nicht mehr aktive Organisationen", () => {
    const snapshot = createReadOrgSnapshot({
      userId: "user-a",
      activeOrgId: "org-a",
      memberships,
      now: new Date(1000),
    });

    expect(
      isReadOrgSnapshotUsable(snapshot, {
        userId: "user-a",
        activeOrgId: "org-b",
        minRole: "READONLY",
        now: new Date(2000),
      })
    ).toBe(false);
  });

  it("verwirft Snapshots bei Sign-out oder Ablauf nach hoechstens 30 Minuten", () => {
    const snapshot = createReadOrgSnapshot({
      userId: "user-a",
      activeOrgId: "org-a",
      memberships,
      now: new Date(1000),
    });

    expect(
      isReadOrgSnapshotUsable(snapshot, {
        userId: null,
        activeOrgId: "org-a",
        minRole: "READONLY",
        now: new Date(2000),
      })
    ).toBe(false);
    expect(
      isReadOrgSnapshotUsable(snapshot, {
        userId: "user-a",
        activeOrgId: "org-a",
        minRole: "READONLY",
        now: new Date(1000 + READ_ORG_SNAPSHOT_MAX_AGE_MS),
      })
    ).toBe(false);
  });

  it("akzeptiert keinen manipulierten Gueltigkeitszeitraum ueber 30 Minuten", () => {
    expect(
      isReadOrgSnapshotUsable(
        {
          userId: "user-a",
          orgId: "org-a",
          role: "OWNER",
          issuedAtMs: 1000,
          expiresAtMs: 1000 + READ_ORG_SNAPSHOT_MAX_AGE_MS + 1,
        },
        {
          userId: "user-a",
          activeOrgId: "org-a",
          minRole: "READONLY",
          now: new Date(2000),
        }
      )
    ).toBe(false);
  });
});
