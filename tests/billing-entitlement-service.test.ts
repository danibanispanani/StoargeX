import { describe, expect, it } from "vitest";
import {
  getConsignmentTrialEligibility,
  classifySubscriptionPrices,
  projectConsignmentSubscription,
  type BillingPriceCatalog,
} from "@/lib/services/billing-entitlement-service";

const CATALOG: BillingPriceCatalog = {
  base: {
    priceProMonthly: "PRO",
    priceBusinessMonthly: "BUSINESS",
  },
  consignment: new Set(["priceConsignmentMonthly", "priceConsignmentYearly"]),
};

const NOW = new Date("2026-07-17T10:00:00.000Z");

describe("classifySubscriptionPrices", () => {
  it("separates base tiers and the consignment add-on", () => {
    expect(
      classifySubscriptionPrices(
        ["priceProMonthly", "priceConsignmentMonthly"],
        CATALOG
      )
    ).toEqual({
      baseTier: "PRO",
      hasConsignmentAddon: true,
    });

    expect(
      classifySubscriptionPrices(["priceConsignmentMonthly"], CATALOG)
    ).toEqual({
      baseTier: null,
      hasConsignmentAddon: true,
    });
  });

  it("ignores unknown prices instead of deriving FREE", () => {
    expect(classifySubscriptionPrices(["priceUnknown"], CATALOG)).toEqual({
      baseTier: null,
      hasConsignmentAddon: false,
    });
  });
});

describe("projectConsignmentSubscription", () => {
  it("projects Stripe trial and active states", () => {
    expect(
      projectConsignmentSubscription({
        status: "trialing",
        cancelAtPeriodEnd: false,
        periodEnd: new Date("2026-07-31T10:00:00.000Z"),
        trialEnd: new Date("2026-07-24T10:00:00.000Z"),
        now: NOW,
      })
    ).toMatchObject({
      status: "ACTIVE",
      source: "TRIAL",
      endsAt: new Date("2026-07-24T10:00:00.000Z"),
    });

    expect(
      projectConsignmentSubscription({
        status: "active",
        cancelAtPeriodEnd: false,
        periodEnd: new Date("2026-08-17T10:00:00.000Z"),
        trialEnd: null,
        now: NOW,
      })
    ).toMatchObject({
      status: "ACTIVE",
      source: "ADD_ON",
      endsAt: new Date("2026-08-17T10:00:00.000Z"),
    });
  });

  it("projects cancel-at-period-end as access until period end", () => {
    expect(
      projectConsignmentSubscription({
        status: "active",
        cancelAtPeriodEnd: true,
        periodEnd: new Date("2026-08-17T10:00:00.000Z"),
        trialEnd: null,
        now: NOW,
      })
    ).toMatchObject({
      status: "CANCELLED",
      source: "ADD_ON",
      endsAt: new Date("2026-08-17T10:00:00.000Z"),
    });
  });

  it("starts a fixed grace period and does not extend it on retries", () => {
    const first = projectConsignmentSubscription({
      status: "past_due",
      cancelAtPeriodEnd: false,
      periodEnd: null,
      trialEnd: null,
      now: NOW,
      gracePeriodDays: 7,
      existingGraceEndsAt: null,
    });
    const retry = projectConsignmentSubscription({
      status: "past_due",
      cancelAtPeriodEnd: false,
      periodEnd: null,
      trialEnd: null,
      now: new Date("2026-07-19T10:00:00.000Z"),
      gracePeriodDays: 7,
      existingGraceEndsAt: first.endsAt,
    });

    expect(first).toMatchObject({
      status: "GRACE_PERIOD",
      endsAt: new Date("2026-07-24T10:00:00.000Z"),
    });
    expect(retry.endsAt).toEqual(first.endsAt);
  });

  it("expires canceled and unpaid subscriptions", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"] as const) {
      expect(
        projectConsignmentSubscription({
          status,
          cancelAtPeriodEnd: false,
          periodEnd: null,
          trialEnd: null,
          now: NOW,
        })
      ).toMatchObject({
        status: "EXPIRED",
        source: "ADD_ON",
        endsAt: NOW,
      });
    }
  });
});

describe("getConsignmentTrialEligibility", () => {
  it("allows one trial for a base-tier organization without prior grants", () => {
    expect(
      getConsignmentTrialEligibility({
        organizationId: "org-1",
        subscriptionTier: "PRO",
        grants: [],
        now: NOW,
      })
    ).toEqual({ eligible: true, reason: null });
  });

  it("rejects repeated trials and organizations with existing access", () => {
    expect(
      getConsignmentTrialEligibility({
        organizationId: "org-1",
        subscriptionTier: "PRO",
        grants: [
          {
            id: "old-trial",
            organizationId: "org-1",
            featureKey: "CONSIGNMENT",
            status: "EXPIRED",
            source: "TRIAL",
            startsAt: new Date("2026-06-01T00:00:00.000Z"),
            endsAt: new Date("2026-06-15T00:00:00.000Z"),
          },
        ],
        now: NOW,
      })
    ).toEqual({ eligible: false, reason: "TRIAL_ALREADY_USED" });

    expect(
      getConsignmentTrialEligibility({
        organizationId: "org-1",
        subscriptionTier: "BUSINESS",
        grants: [],
        now: NOW,
      })
    ).toEqual({ eligible: false, reason: "ALREADY_ENTITLED" });
  });
});
