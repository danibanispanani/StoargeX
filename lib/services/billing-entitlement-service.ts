import {
  evaluateFeatureEntitlement,
  FEATURE_KEYS,
  type FeatureEntitlementGrant,
  EntitlementSource,
  EntitlementStatus,
  SubscriptionTier,
} from "@/lib/services/feature-entitlement-service";

export interface BillingPriceCatalog {
  base: Readonly<Record<string, Exclude<SubscriptionTier, "FREE">>>;
  consignment: ReadonlySet<string>;
}

export interface ClassifiedSubscriptionPrices {
  baseTier: Exclude<SubscriptionTier, "FREE"> | null;
  hasConsignmentAddon: boolean;
}

export function classifySubscriptionPrices(
  priceIds: readonly string[],
  catalog: BillingPriceCatalog
): ClassifiedSubscriptionPrices {
  let baseTier: ClassifiedSubscriptionPrices["baseTier"] = null;
  let hasConsignmentAddon = false;

  for (const priceId of priceIds) {
    baseTier = catalog.base[priceId] ?? baseTier;
    hasConsignmentAddon ||= catalog.consignment.has(priceId);
  }

  return { baseTier, hasConsignmentAddon };
}

export function getConsignmentTrialEligibility(input: {
  organizationId: string;
  subscriptionTier: SubscriptionTier;
  grants: readonly FeatureEntitlementGrant[];
  now: Date;
}):
  | { eligible: true; reason: null }
  | {
      eligible: false;
      reason: "TRIAL_ALREADY_USED" | "ALREADY_ENTITLED";
    } {
  const trialAlreadyUsed = input.grants.some(
    (grant) =>
      grant.organizationId === input.organizationId &&
      grant.featureKey === FEATURE_KEYS.CONSIGNMENT &&
      grant.source === "TRIAL"
  );
  if (trialAlreadyUsed) {
    return { eligible: false, reason: "TRIAL_ALREADY_USED" };
  }

  const currentAccess = evaluateFeatureEntitlement({
    organizationId: input.organizationId,
    featureKey: FEATURE_KEYS.CONSIGNMENT,
    grants: input.grants,
    subscriptionTier: input.subscriptionTier,
    at: input.now,
  });
  if (currentAccess.enabled) {
    return { eligible: false, reason: "ALREADY_ENTITLED" };
  }

  return { eligible: true, reason: null };
}

export interface ConsignmentSubscriptionProjection {
  status: EntitlementStatus;
  source: EntitlementSource;
  endsAt: Date | null;
}

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export function projectConsignmentSubscription(input: {
  status: StripeSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
  trialEnd: Date | null;
  now: Date;
  gracePeriodDays?: number;
  existingGraceEndsAt?: Date | null;
}): ConsignmentSubscriptionProjection {
  if (input.status === "trialing") {
    return {
      status: input.cancelAtPeriodEnd ? "CANCELLED" : "ACTIVE",
      source: "TRIAL",
      endsAt: input.trialEnd ?? input.periodEnd,
    };
  }

  if (input.status === "active") {
    return {
      status: input.cancelAtPeriodEnd ? "CANCELLED" : "ACTIVE",
      source: "ADD_ON",
      endsAt: input.periodEnd,
    };
  }

  if (input.status === "past_due") {
    const configuredDays = Math.max(1, input.gracePeriodDays ?? 7);
    const endsAt =
      input.existingGraceEndsAt ??
      new Date(input.now.getTime() + configuredDays * 24 * 60 * 60 * 1000);
    return {
      status: endsAt.getTime() > input.now.getTime() ? "GRACE_PERIOD" : "EXPIRED",
      source: "ADD_ON",
      endsAt,
    };
  }

  return {
    status: input.status === "incomplete" ? "INACTIVE" : "EXPIRED",
    source: "ADD_ON",
    endsAt: input.now,
  };
}
