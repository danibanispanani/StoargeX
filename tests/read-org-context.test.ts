import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMembership: vi.fn(),
  tenantDb: vi.fn((organizationId: string) => ({ organizationId })),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/tenant-db", () => ({ tenantDb: mocks.tenantDb }));
vi.mock("@/lib/prisma", () => ({
  bypassDb: () => ({
    membership: { findUnique: mocks.findMembership },
  }),
}));

import { resolveReadOrgContext, requireOrg } from "@/lib/org";
import { READ_ORG_SNAPSHOT_MAX_AGE_MS } from "@/lib/read-org-snapshot";

function session(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    user: { id: "user-a", totpEnabled: false },
    memberships: [],
    activeOrgId: "org-a",
    activeRole: "MEMBER",
    activeTier: "PRO",
    readOrgSnapshot: {
      userId: "user-a",
      orgId: "org-a",
      role: "MEMBER",
      issuedAtMs: now,
      expiresAtMs: now + READ_ORG_SNAPSHOT_MAX_AGE_MS,
    },
    expires: new Date(now + 60_000).toISOString(),
    ...overrides,
  };
}

describe("resolveReadOrgContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(session());
  });

  it("nutzt fuer normale Reads einen gueltigen serverseitigen Snapshot ohne Membership-Query", async () => {
    await expect(resolveReadOrgContext()).resolves.toEqual({
      ok: true,
      context: {
        userId: "user-a",
        organizationId: "org-a",
        role: "MEMBER",
        source: "snapshot",
        db: { organizationId: "org-a" },
      },
    });

    expect(mocks.findMembership).not.toHaveBeenCalled();
    expect(mocks.tenantDb).toHaveBeenCalledWith("org-a");
  });

  it("faellt bei abgelaufenem Snapshot auf die frische Membership-Pruefung zurueck", async () => {
    mocks.auth.mockResolvedValue(
      session({
        readOrgSnapshot: {
          userId: "user-a",
          orgId: "org-a",
          role: "MEMBER",
          issuedAtMs: 1000,
          expiresAtMs: 1000 + READ_ORG_SNAPSHOT_MAX_AGE_MS,
        },
      })
    );
    mocks.findMembership.mockResolvedValue({
      role: "ADMIN",
      organizationId: "org-a",
      organization: { id: "org-a" },
    });

    const access = await resolveReadOrgContext("ADMIN");

    expect(access).toEqual({
      ok: true,
      context: {
        userId: "user-a",
        organizationId: "org-a",
        role: "ADMIN",
        source: "fresh",
        db: { organizationId: "org-a" },
      },
    });
    expect(mocks.findMembership).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-a",
          userId: "user-a",
        },
      },
      include: { organization: true },
    });
  });

  it("weist Sign-out und fehlende Mitgliedschaft zurueck, ohne Clientwerte zu verwenden", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(resolveReadOrgContext()).resolves.toEqual({
      ok: false,
      status: 401,
    });

    mocks.auth.mockResolvedValue(session({ activeOrgId: "org-b", readOrgSnapshot: null }));
    mocks.findMembership.mockResolvedValue(null);
    await expect(resolveReadOrgContext()).resolves.toEqual({
      ok: false,
      status: 403,
    });

    expect(mocks.tenantDb).not.toHaveBeenCalledWith("org-b");
  });

  it("laesst frische Write-Pruefungen ueber requireOrg unveraendert", async () => {
    mocks.findMembership.mockResolvedValue({
      role: "MEMBER",
      organizationId: "org-a",
      organization: { id: "org-a" },
    });

    const context = await requireOrg("MEMBER");

    expect(context.membership.role).toBe("MEMBER");
    expect(mocks.findMembership).toHaveBeenCalledTimes(1);
  });
});
