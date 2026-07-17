import type {
  EntitlementSource,
  EntitlementStatus,
  Prisma,
  SubscriptionTier,
} from "@prisma/client";
import {
  classifySubscriptionPrices,
  projectConsignmentSubscription,
  type BillingPriceCatalog,
} from "@/lib/services/billing-entitlement-service";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";

export interface StripeSubscriptionItemSnapshot {
  priceId: string;
  periodEnd: Date;
}

export interface StripeSubscriptionSnapshot {
  id: string;
  organizationId: string;
  customerId: string;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  createdAt: Date;
  items: readonly StripeSubscriptionItemSnapshot[];
  metadata: Readonly<Record<string, string>>;
}

export interface StripeBillingSyncResult {
  baseTierChanged: boolean;
  entitlementId: string | null;
  entitlementStatus: EntitlementStatus | null;
}

function isActiveSubscription(status: StripeSubscriptionSnapshot["status"]) {
  return status === "active" || status === "trialing";
}

function metadataTier(
  metadata: Readonly<Record<string, string>>
): Exclude<SubscriptionTier, "FREE"> | null {
  return metadata.tier === "PRO" || metadata.tier === "BUSINESS"
    ? metadata.tier
    : null;
}

function entitlementStart(
  createdAt: Date,
  endsAt: Date | null,
  now: Date
): Date {
  if (!endsAt) return createdAt;
  if (createdAt.getTime() < endsAt.getTime()) return createdAt;
  return new Date(Math.min(now.getTime(), endsAt.getTime()) - 1);
}

function storedStripeStatus(metadata: Prisma.JsonValue): string | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return null;
  }
  const value = metadata.stripeStatus;
  return typeof value === "string" ? value : null;
}

export async function syncStripeSubscriptionInTransaction(input: {
  tx: Prisma.TransactionClient;
  subscription: StripeSubscriptionSnapshot;
  catalog: BillingPriceCatalog;
  now: Date;
  gracePeriodDays: number;
}): Promise<StripeBillingSyncResult> {
  const { tx, subscription, now } = input;
  const priceIds = subscription.items.map((item) => item.priceId);
  const classification = classifySubscriptionPrices(priceIds, input.catalog);
  const baseTier = classification.baseTier ?? metadataTier(subscription.metadata);
  const existingEntitlement = await tx.featureEntitlement.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  const organization = await tx.organization.findUnique({
    where: { id: subscription.organizationId },
    select: { id: true, stripeSubscriptionId: true, subscriptionTier: true },
  });

  if (!organization) {
    throw new Error(
      `Organisation ${subscription.organizationId} fuer Stripe-Abo nicht gefunden.`
    );
  }

  let baseTierChanged = false;
  if (baseTier) {
    const active = isActiveSubscription(subscription.status);
    const ownsCurrentBaseSubscription =
      organization.stripeSubscriptionId === subscription.id;
    if (active || ownsCurrentBaseSubscription) {
      const targetTier: SubscriptionTier = active ? baseTier : "FREE";
      const targetSubscriptionId = active ? subscription.id : null;
      await tx.organization.update({
        where: { id: organization.id },
        data: {
          subscriptionTier: targetTier,
          stripeSubscriptionId: targetSubscriptionId,
        },
      });
      baseTierChanged =
        targetTier !== organization.subscriptionTier ||
        targetSubscriptionId !== organization.stripeSubscriptionId;

      if (baseTierChanged) {
        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            action: "billing.tier_sync",
            entityType: "Organization",
            entityId: organization.id,
            before: {
              tier: organization.subscriptionTier,
              subscriptionId: organization.stripeSubscriptionId,
            },
            after: {
              tier: targetTier,
              subscriptionId: targetSubscriptionId,
              stripeStatus: subscription.status,
            },
          },
        });
      }
    }
  }

  const metadataMarksAddon =
    subscription.metadata.billingKind === "ADD_ON" &&
    subscription.metadata.featureKey === FEATURE_KEYS.CONSIGNMENT;
  const shouldSyncAddon =
    classification.hasConsignmentAddon ||
    metadataMarksAddon ||
    Boolean(existingEntitlement);

  if (!shouldSyncAddon) {
    return {
      baseTierChanged,
      entitlementId: null,
      entitlementStatus: null,
    };
  }

  const addonItem =
    subscription.items.find((item) => input.catalog.consignment.has(item.priceId)) ??
    (metadataMarksAddon ? subscription.items[0] : undefined);
  const existingGraceEndsAt =
    existingEntitlement?.status === "GRACE_PERIOD" ||
    (existingEntitlement?.status === "EXPIRED" &&
      storedStripeStatus(existingEntitlement.metadata) === "past_due")
      ? existingEntitlement.endsAt
      : null;
  const projected =
    addonItem || metadataMarksAddon
      ? projectConsignmentSubscription({
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          periodEnd: addonItem?.periodEnd ?? null,
          trialEnd: subscription.trialEnd,
          now,
          gracePeriodDays: input.gracePeriodDays,
          existingGraceEndsAt,
        })
      : ({
          status: "EXPIRED",
          source: existingEntitlement?.source ?? "ADD_ON",
          endsAt: now,
        } satisfies {
          status: EntitlementStatus;
          source: EntitlementSource;
          endsAt: Date | null;
        });

  const startsAt = entitlementStart(
    existingEntitlement?.startsAt ?? subscription.createdAt,
    projected.endsAt,
    now
  );
  const commonData = {
    organizationId: subscription.organizationId,
    featureKey: FEATURE_KEYS.CONSIGNMENT,
    status: projected.status,
    source: projected.source,
    startsAt,
    endsAt: projected.endsAt,
    externalRef: `stripe:${subscription.id}`,
    stripePriceId: addonItem?.priceId ?? null,
    metadata: {
      provider: "stripe",
      stripeStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } satisfies Prisma.InputJsonValue,
  };

  const entitlement = existingEntitlement
    ? await tx.featureEntitlement.update({
        where: { id: existingEntitlement.id },
        data: commonData,
      })
    : await tx.featureEntitlement.create({
        data: {
          ...commonData,
          stripeSubscriptionId: subscription.id,
        },
      });

  await tx.auditLog.create({
    data: {
      organizationId: subscription.organizationId,
      action: "billing.consignment_addon_sync",
      entityType: "FeatureEntitlement",
      entityId: entitlement.id,
      before: existingEntitlement
        ? {
            status: existingEntitlement.status,
            source: existingEntitlement.source,
            endsAt: existingEntitlement.endsAt?.toISOString() ?? null,
          }
        : undefined,
      after: {
        status: entitlement.status,
        source: entitlement.source,
        endsAt: entitlement.endsAt?.toISOString() ?? null,
        stripeSubscriptionId: subscription.id,
      },
    },
  });

  return {
    baseTierChanged,
    entitlementId: entitlement.id,
    entitlementStatus: entitlement.status,
  };
}
