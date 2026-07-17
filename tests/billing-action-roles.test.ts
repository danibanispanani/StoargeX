import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireOrg: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  updateSession: vi.fn(),
}));
vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  priceIdFor: vi.fn(),
  consignmentPriceIdFor: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/feature-access", () => ({ getFeatureAccess: vi.fn() }));

import {
  createConsignmentAddonCheckoutAction,
  redeemConsignmentAddonCodeAction,
  startConsignmentTrialAction,
} from "@/lib/actions/billing";

describe("consignment add-on billing roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.requireOrg.mockRejectedValue(new Error("owner required"));
  });

  it("requires OWNER for checkout, trial, and manual enablement", async () => {
    await expect(
      createConsignmentAddonCheckoutAction(null, new FormData())
    ).rejects.toThrow("owner required");
    await expect(
      startConsignmentTrialAction(null, new FormData())
    ).rejects.toThrow("owner required");
    await expect(
      redeemConsignmentAddonCodeAction(null, new FormData())
    ).rejects.toThrow("owner required");

    expect(mocks.requireOrg).toHaveBeenCalledTimes(3);
    expect(mocks.requireOrg).toHaveBeenNthCalledWith(1, "OWNER");
    expect(mocks.requireOrg).toHaveBeenNthCalledWith(2, "OWNER");
    expect(mocks.requireOrg).toHaveBeenNthCalledWith(3, "OWNER");
  });
});
