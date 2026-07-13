export const FEATURE_KEYS = {
  CONSIGNMENT: "CONSIGNMENT",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS] | string;
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

const LEGACY_TIER_FEATURES: Readonly<Record<SubscriptionTier, readonly string[]>> = {
  FREE: [],
  PRO: [],
  BUSINESS: [FEATURE_KEYS.CONSIGNMENT],
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
  const grant = input.grants
    .filter(
      (candidate) =>
        candidate.organizationId === input.organizationId &&
        candidate.featureKey === input.featureKey &&
        isEntitlementGrantActive(candidate, at)
    )
    .sort((left, right) => {
      const rightEnd = right.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const leftEnd = left.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return rightEnd - leftEnd;
    })[0];

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
