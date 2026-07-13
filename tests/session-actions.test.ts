import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signOut: vi.fn(),
  updateSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  findMembership: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  signOut: mocks.signOut,
  updateSession: mocks.updateSession,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/prisma", () => ({
  bypassDb: () => ({
    membership: { findUnique: mocks.findMembership },
  }),
}));

import { switchOrganizationAction } from "@/lib/actions/session";

function organizationForm(organizationId: string) {
  const formData = new FormData();
  formData.set("organizationId", organizationId);
  return formData;
}

describe("switchOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
  });

  it("leitet nicht angemeldete Aufrufe um, ohne Mitgliedschaften abzufragen", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(
      switchOrganizationAction(organizationForm("org-a"))
    ).rejects.toThrow("REDIRECT:/login");

    expect(mocks.findMembership).not.toHaveBeenCalled();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("weist fremde Organisationen zurück und verändert die Session nicht", async () => {
    mocks.findMembership.mockResolvedValue(null);

    await expect(
      switchOrganizationAction(organizationForm("org-b"))
    ).rejects.toThrow("Keine Berechtigung für diese Organisation.");

    expect(mocks.findMembership).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-b",
          userId: "user-a",
        },
      },
      select: { organizationId: true },
    });
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("übernimmt nur die von der Datenbank bestätigte Organisation", async () => {
    mocks.findMembership.mockResolvedValue({ organizationId: "org-a" });

    await expect(
      switchOrganizationAction(organizationForm("org-a"))
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.updateSession).toHaveBeenCalledWith({ activeOrgId: "org-a" });
  });
});
