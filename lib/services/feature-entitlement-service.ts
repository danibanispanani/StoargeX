export const FEATURE_KEYS = {
  CONSIGNMENT: "CONSIGNMENT",
} as const;

export type KnownFeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
export type FeatureKey = KnownFeatureKey | (string & Record<never, never>);
export type EntitlementStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "CANCELLED";
export type EntitlementSource = "SUBSCRIPTION" | "ADD_ON" | "TRIAL" | "MANUAL";
export type SubscriptionTier = "FREE" | "PRO" | "BUSINESS";

export interface FeatureEntitlementGrant {
  id: string;
  organizationId: string;
  featureKey: string;
  status: EntitlementStatus;
  source: EntitlementSource;
  startsAt: Date;
  endsAt: Date | null;
}

export interface FeatureEntitlementDecision {
  enabled: boolean;
  source: EntitlementSource | "LEGACY_TIER" | null;
  grantId: string | null;
  validUntil: Date | null;
}

export interface FeatureEntitlementSnapshot {
  enabled: boolean;
  source: FeatureEntitlementDecision["source"];
  validUntil: string | null;
  trialDaysRemaining: number | null;
}

const LEGACY_TIER_FEATURES: Readonly<Record<SubscriptionTier, readonly string[]>> = {
  FREE: [],
  PRO: [],
  BUSINESS: [FEATURE_KEYS.CONSIGNMENT],
};

const SOURCE_PRIORITY: Readonly<Record<EntitlementSource, number>> = {
  TRIAL: 0,
  SUBSCRIPTION: 1,
  ADD_ON: 2,
  MANUAL: 3,
};

export function isEntitlementGrantActive(
  grant: FeatureEntitlementGrant,
  at: Date = new Date()
): boolean {
  return (
    grant.status === "ACTIVE" &&
    grant.startsAt.getTime() <= at.getTime() &&
    (grant.endsAt === null || grant.endsAt.getTime() > at.getTime())
  );
}

export function evaluateFeatureEntitlement(input: {
  organizationId: string;
  featureKey: FeatureKey;
  grants: readonly FeatureEntitlementGrant[];
  subscriptionTier?: SubscriptionTier | null;
  at?: Date;
}): FeatureEntitlementDecision {
  const at = input.at ?? new Date();
  const grant = input.grants.reduce<FeatureEntitlementGrant | null>(
    (preferred, candidate) => {
      if (
        candidate.organizationId !== input.organizationId ||
        candidate.featureKey !== input.featureKey ||
        !isEntitlementGrantActive(candidate, at)
      ) {
        return preferred;
      }

      if (!preferred) return candidate;

      const candidateEnd = candidate.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const preferredEnd = preferred.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (candidateEnd !== preferredEnd) {
        return candidateEnd > preferredEnd ? candidate : preferred;
      }

      const sourceDifference =
        SOURCE_PRIORITY[candidate.source] - SOURCE_PRIORITY[preferred.source];
      if (sourceDifference !== 0) {
        return sourceDifference > 0 ? candidate : preferred;
      }

      const startsDifference =
        candidate.startsAt.getTime() - preferred.startsAt.getTime();
      if (startsDifference !== 0) {
        return startsDifference > 0 ? candidate : preferred;
      }

      return candidate.id.localeCompare(preferred.id) < 0 ? candidate : preferred;
    },
    null
  );

  if (grant) {
    return {
      enabled: true,
      source: grant.source,
      grantId: grant.id,
      validUntil: grant.endsAt,
    };
  }

  if (
    input.subscriptionTier &&
    LEGACY_TIER_FEATURES[input.subscriptionTier].includes(input.featureKey)
  ) {
    return {
      enabled: true,
      source: "LEGACY_TIER",
      grantId: null,
      validUntil: null,
    };
  }

  return { enabled: false, source: null, grantId: null, validUntil: null };
}

export function hasFeatureEntitlement(
  input: Parameters<typeof evaluateFeatureEntitlement>[0]
): boolean {
  return evaluateFeatureEntitlement(input).enabled;
}

export function toFeatureEntitlementSnapshot(
  decision: FeatureEntitlementDecision,
  at: Date = new Date()
): FeatureEntitlementSnapshot {
  const trialDaysRemaining =
    decision.enabled && decision.source === "TRIAL" && decision.validUntil
      ? Math.max(
          0,
          Math.ceil(
            (decision.validUntil.getTime() - at.getTime()) / (24 * 60 * 60 * 1000)
          )
        )
      : null;

  return {
    enabled: decision.enabled,
    source: decision.source,
    validUntil: decision.validUntil?.toISOString() ?? null,
    trialDaysRemaining,
  };
}
