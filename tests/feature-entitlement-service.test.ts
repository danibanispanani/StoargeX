import { describe, expect, it } from "vitest";
import {
  evaluateFeatureEntitlement,
  FEATURE_KEYS,
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
    ).toEqual({ enabled: true, source: "TRIAL", grantId: "grant-1", validUntil: endsAt });
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
});
