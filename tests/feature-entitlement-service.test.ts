import { describe, expect, it } from "vitest";
import {
  evaluateFeatureEntitlement,
  FEATURE_KEYS,
  toFeatureEntitlementSnapshot,
  type FeatureEntitlementGrant,
} from "@/lib/services/feature-entitlement-service";

const NOW = new Date("2026-07-13T10:00:00.000Z");

function grant(
  overrides: Partial<FeatureEntitlementGrant> = {}
): FeatureEntitlementGrant {
  return {
    id: "grant-1",
    organizationId: "org-1",
    featureKey: FEATURE_KEYS.CONSIGNMENT,
    status: "ACTIVE",
    source: "ADD_ON",
    startsAt: new Date("2026-07-01T00:00:00.000Z"),
    endsAt: null,
    ...overrides,
  };
}

describe("evaluateFeatureEntitlement", () => {
  it("aktiviert ein aktuell gültiges Add-on", () => {
    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [grant()],
        at: NOW,
      })
    ).toMatchObject({ enabled: true, source: "ADD_ON", grantId: "grant-1" });
  });

  it("ignoriert inaktive, zukünftige, abgelaufene und fremde Grants", () => {
    const ignored = [
      grant({ id: "inactive", status: "INACTIVE" }),
      grant({ id: "future", startsAt: new Date("2026-08-01T00:00:00.000Z") }),
      grant({ id: "expired", endsAt: NOW }),
      grant({ id: "other-tenant", organizationId: "org-2" }),
    ];
    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: ignored,
        at: NOW,
      }).enabled
    ).toBe(false);
  });

  it("behandelt einen aktiven Trial im Zeitfenster als gültige Berechtigung", () => {
    const endsAt = new Date("2026-07-20T00:00:00.000Z");
    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [grant({ source: "TRIAL", endsAt })],
        at: NOW,
      })
    ).toEqual({
      enabled: true,
      source: "TRIAL",
      status: "ACTIVE",
      grantId: "grant-1",
      validUntil: endsAt,
    });
  });

  it("keeps a grace period active only until its fixed end", () => {
    const endsAt = new Date("2026-07-16T10:00:00.000Z");
    const graceGrant = grant({ status: "GRACE_PERIOD", endsAt });

    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [graceGrant],
        at: NOW,
      })
    ).toMatchObject({ enabled: true, status: "GRACE_PERIOD", validUntil: endsAt });

    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [graceGrant],
        at: endsAt,
      }).enabled
    ).toBe(false);
  });

  it("keeps a cancel-at-period-end add-on active only until period end", () => {
    const endsAt = new Date("2026-08-01T00:00:00.000Z");
    const cancelledGrant = grant({ status: "CANCELLED", endsAt });

    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [cancelledGrant],
        at: NOW,
      })
    ).toMatchObject({ enabled: true, status: "CANCELLED", validUntil: endsAt });

    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [cancelledGrant],
        at: endsAt,
      }).enabled
    ).toBe(false);
  });

  it("erhält die bestehende BUSINESS-Tier-Berechtigung additiv", () => {
    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        grants: [],
        subscriptionTier: "BUSINESS",
        at: NOW,
      }).source
    ).toBe("LEGACY_TIER");
  });

  it("akzeptiert zukünftige Integrations-Keys ohne neue Policy-Implementierung", () => {
    const integrationKey = "INTEGRATION_MARKETPLACE_SYNC";
    expect(
      evaluateFeatureEntitlement({
        organizationId: "org-1",
        featureKey: integrationKey,
        grants: [grant({ featureKey: integrationKey })],
        at: NOW,
      })
    ).toMatchObject({ enabled: true, source: "ADD_ON" });
  });

  it("selects the stronger source deterministically for equal grants", () => {
    const decision = evaluateFeatureEntitlement({
      organizationId: "org-1",
      featureKey: FEATURE_KEYS.CONSIGNMENT,
      grants: [
        grant({ id: "trial", source: "TRIAL", endsAt: null }),
        grant({ id: "manual", source: "MANUAL", endsAt: null }),
      ],
      at: NOW,
    });

    expect(decision).toMatchObject({ source: "MANUAL", grantId: "manual" });
  });

  it("projects stable trial days for the app shell", () => {
    const decision = evaluateFeatureEntitlement({
      organizationId: "org-1",
      featureKey: FEATURE_KEYS.CONSIGNMENT,
      grants: [
        grant({
          source: "TRIAL",
          endsAt: new Date("2026-07-15T09:59:59.000Z"),
        }),
      ],
      at: NOW,
    });

    expect(toFeatureEntitlementSnapshot(decision, NOW)).toEqual({
      enabled: true,
      source: "TRIAL",
      status: "ACTIVE",
      validUntil: "2026-07-15T09:59:59.000Z",
      trialDaysRemaining: 2,
      graceDaysRemaining: null,
      cancelAtPeriodEnd: false,
    });
  });

  it("projects grace and cancellation state for billing and navigation", () => {
    const graceDecision = evaluateFeatureEntitlement({
      organizationId: "org-1",
      featureKey: FEATURE_KEYS.CONSIGNMENT,
      grants: [
        grant({
          status: "GRACE_PERIOD",
          endsAt: new Date("2026-07-15T09:59:59.000Z"),
        }),
      ],
      at: NOW,
    });
    const cancelledDecision = evaluateFeatureEntitlement({
      organizationId: "org-1",
      featureKey: FEATURE_KEYS.CONSIGNMENT,
      grants: [
        grant({
          status: "CANCELLED",
          endsAt: new Date("2026-07-20T00:00:00.000Z"),
        }),
      ],
      at: NOW,
    });

    expect(toFeatureEntitlementSnapshot(graceDecision, NOW)).toMatchObject({
      status: "GRACE_PERIOD",
      graceDaysRemaining: 2,
      cancelAtPeriodEnd: false,
    });
    expect(toFeatureEntitlementSnapshot(cancelledDecision, NOW)).toMatchObject({
      status: "CANCELLED",
      graceDaysRemaining: null,
      cancelAtPeriodEnd: true,
    });
  });
});
