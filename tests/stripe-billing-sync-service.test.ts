import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { syncStripeSubscriptionInTransaction } from "@/lib/services/stripe-billing-sync-service";
import type { BillingPriceCatalog } from "@/lib/services/billing-entitlement-service";

const NOW = new Date("2026-07-17T10:00:00.000Z");
const PERIOD_END = new Date("2026-08-17T10:00:00.000Z");
const CATALOG: BillingPriceCatalog = {
  base: {
    pricePro: "PRO",
    priceBusiness: "BUSINESS",
  },
  consignment: new Set(["priceConsignment"]),
};

function createTx(input?: {
  existingEntitlement?: Record<string, unknown> | null;
  subscriptionTier?: "FREE" | "PRO" | "BUSINESS";
  baseSubscriptionId?: string | null;
}) {
  const organizationUpdate = vi.fn(async ({ data }) => data);
  const entitlementCreate = vi.fn(async ({ data }) => ({
    id: "entitlement-1",
    ...data,
  }));
  const entitlementUpdate = vi.fn(async ({ data }) => ({
    id: "entitlement-1",
    ...data,
  }));
  const auditCreate = vi.fn(async ({ data }) => data);
  const tx = {
    organization: {
      findUnique: vi.fn(async () => ({
        id: "org-1",
        subscriptionTier: input?.subscriptionTier ?? "PRO",
        stripeSubscriptionId: input?.baseSubscriptionId ?? "sub_base",
      })),
      update: organizationUpdate,
    },
    featureEntitlement: {
      findUnique: vi.fn(async () => input?.existingEntitlement ?? null),
      create: entitlementCreate,
      update: entitlementUpdate,
    },
    auditLog: { create: auditCreate },
  } as unknown as Prisma.TransactionClient;

  return {
    tx,
    organizationUpdate,
    entitlementCreate,
    entitlementUpdate,
    auditCreate,
  };
}

describe("syncStripeSubscriptionInTransaction", () => {
  it("activates an add-on without changing the base tier subscription", async () => {
    const harness = createTx();

    const result = await syncStripeSubscriptionInTransaction({
      tx: harness.tx,
      catalog: CATALOG,
      now: NOW,
      gracePeriodDays: 7,
      subscription: {
        id: "sub_addon",
        organizationId: "org-1",
        customerId: "cus_1",
        status: "active",
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        items: [{ priceId: "priceConsignment", periodEnd: PERIOD_END }],
        metadata: {
          billingKind: "ADD_ON",
          featureKey: "CONSIGNMENT",
        },
      },
    });

    expect(result).toMatchObject({
      baseTierChanged: false,
      entitlementStatus: "ACTIVE",
    });
    expect(harness.organizationUpdate).not.toHaveBeenCalled();
    expect(harness.entitlementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        featureKey: "CONSIGNMENT",
        stripeSubscriptionId: "sub_addon",
        status: "ACTIVE",
      }),
    });
  });

  it("updates a base tier without creating an add-on entitlement", async () => {
    const harness = createTx({
      subscriptionTier: "PRO",
      baseSubscriptionId: "sub_old",
    });

    const result = await syncStripeSubscriptionInTransaction({
      tx: harness.tx,
      catalog: CATALOG,
      now: NOW,
      gracePeriodDays: 7,
      subscription: {
        id: "sub_business",
        organizationId: "org-1",
        customerId: "cus_1",
        status: "active",
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        items: [{ priceId: "priceBusiness", periodEnd: PERIOD_END }],
        metadata: { billingKind: "BASE", tier: "BUSINESS" },
      },
    });

    expect(result).toEqual({
      baseTierChanged: true,
      entitlementId: null,
      entitlementStatus: null,
    });
    expect(harness.organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        subscriptionTier: "BUSINESS",
        stripeSubscriptionId: "sub_business",
      },
    });
    expect(harness.entitlementCreate).not.toHaveBeenCalled();
  });

  it("expires the entitlement without deleting retained consignment data", async () => {
    const existingEntitlement = {
      id: "entitlement-1",
      organizationId: "org-1",
      featureKey: "CONSIGNMENT",
      status: "ACTIVE",
      source: "ADD_ON",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: PERIOD_END,
      stripeSubscriptionId: "sub_addon",
    };
    const harness = createTx({ existingEntitlement });

    const result = await syncStripeSubscriptionInTransaction({
      tx: harness.tx,
      catalog: CATALOG,
      now: NOW,
      gracePeriodDays: 7,
      subscription: {
        id: "sub_addon",
        organizationId: "org-1",
        customerId: "cus_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        items: [],
        metadata: {
          billingKind: "ADD_ON",
          featureKey: "CONSIGNMENT",
        },
      },
    });

    expect(result.entitlementStatus).toBe("EXPIRED");
    expect(harness.entitlementUpdate).toHaveBeenCalledWith({
      where: { id: "entitlement-1" },
      data: expect.objectContaining({ status: "EXPIRED" }),
    });
    expect(harness.entitlementCreate).not.toHaveBeenCalled();
  });

  it("does not restart a grace period after its fixed boundary expired", async () => {
    const graceEnd = new Date("2026-07-16T10:00:00.000Z");
    const harness = createTx({
      existingEntitlement: {
        id: "entitlement-1",
        organizationId: "org-1",
        featureKey: "CONSIGNMENT",
        status: "EXPIRED",
        source: "ADD_ON",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: graceEnd,
        stripeSubscriptionId: "sub_addon",
        metadata: { stripeStatus: "past_due" },
      },
    });

    await syncStripeSubscriptionInTransaction({
      tx: harness.tx,
      catalog: CATALOG,
      now: NOW,
      gracePeriodDays: 7,
      subscription: {
        id: "sub_addon",
        organizationId: "org-1",
        customerId: "cus_1",
        status: "past_due",
        cancelAtPeriodEnd: false,
        trialEnd: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        items: [{ priceId: "priceConsignment", periodEnd: PERIOD_END }],
        metadata: {
          billingKind: "ADD_ON",
          featureKey: "CONSIGNMENT",
        },
      },
    });

    expect(harness.entitlementUpdate).toHaveBeenCalledWith({
      where: { id: "entitlement-1" },
      data: expect.objectContaining({
        status: "EXPIRED",
        endsAt: graceEnd,
      }),
    });
  });
});
