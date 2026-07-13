import type { Role } from "@prisma/client";
import { cache } from "react";
import { requireOrg, type OrgContext } from "@/lib/org";
import type { TenantDb } from "@/lib/tenant-db";
import {
  evaluateFeatureEntitlement,
  type FeatureEntitlementDecision,
  type FeatureKey,
} from "@/lib/services/feature-entitlement-service";

export class FeatureAccessDeniedError extends Error {
  constructor(public readonly featureKey: FeatureKey) {
    super(`Feature ${featureKey} ist für diese Organisation nicht aktiviert.`);
    this.name = "FeatureAccessDeniedError";
  }
}

export async function getOrganizationFeatureAccess(input: {
  db: TenantDb;
  organizationId: string;
  subscriptionTier: OrgContext["organization"]["subscriptionTier"];
  featureKey: FeatureKey;
  at?: Date;
}): Promise<FeatureEntitlementDecision> {
  const at = input.at ?? new Date();

  const grants = await input.db.featureEntitlement.findMany({
    where: {
      organizationId: input.organizationId,
      featureKey: input.featureKey,
      status: "ACTIVE",
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: {
      id: true,
      organizationId: true,
      featureKey: true,
      status: true,
      source: true,
      startsAt: true,
      endsAt: true,
    },
  });

  return evaluateFeatureEntitlement({
    organizationId: input.organizationId,
    subscriptionTier: input.subscriptionTier,
    featureKey: input.featureKey,
    grants,
    at,
  });
}

export async function getFeatureAccess(
  context: OrgContext,
  featureKey: FeatureKey,
  at?: Date
): Promise<FeatureEntitlementDecision> {
  if (!at) {
    return getCachedFeatureAccess(context, featureKey);
  }

  return getOrganizationFeatureAccess({
    db: context.db,
    organizationId: context.organization.id,
    subscriptionTier: context.organization.subscriptionTier,
    featureKey,
    at,
  });
}

const getCachedFeatureAccess = cache(
  (context: OrgContext, featureKey: FeatureKey) =>
    getOrganizationFeatureAccess({
      db: context.db,
      organizationId: context.organization.id,
      subscriptionTier: context.organization.subscriptionTier,
      featureKey,
    })
);

export async function assertFeatureAccess(
  context: OrgContext,
  featureKey: FeatureKey,
  at: Date = new Date()
): Promise<FeatureEntitlementDecision> {
  const decision = await getFeatureAccess(context, featureKey, at);
  if (!decision.enabled) throw new FeatureAccessDeniedError(featureKey);
  return decision;
}

export async function requireOrgFeature(
  featureKey: FeatureKey,
  minRole: Role = "READONLY",
  at: Date = new Date()
): Promise<OrgContext & { featureDecision: FeatureEntitlementDecision }> {
  const context = await requireOrg(minRole);
  const featureDecision = await assertFeatureAccess(context, featureKey, at);
  return { ...context, featureDecision };
}
