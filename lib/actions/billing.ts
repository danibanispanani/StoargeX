"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Organization, SubscriptionTier } from "@prisma/client";
import { auth, updateSession } from "@/auth";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import {
  consignmentPriceIdFor,
  getStripe,
  priceIdFor,
} from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";
import { getFeatureAccess } from "@/lib/feature-access";
import {
  FEATURE_KEYS,
  evaluateFeatureEntitlement,
} from "@/lib/services/feature-entitlement-service";
import { getConsignmentTrialEligibility } from "@/lib/services/billing-entitlement-service";
import { configuredConsignmentTrialDays } from "@/lib/billing-config";

const checkoutSchema = z.object({
  tier: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["monthly", "yearly"]),
});

const planCodeSchema = z.object({
  code: z.string().trim().min(1, "Code fehlt."),
});

const addonCheckoutSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
});

function baseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

async function ensureStripeCustomer(input: {
  stripe: NonNullable<ReturnType<typeof getStripe>>;
  organization: Organization;
  email?: string | null;
}): Promise<string> {
  if (input.organization.stripeCustomerId) {
    return input.organization.stripeCustomerId;
  }

  const customer = await input.stripe.customers.create({
    name: input.organization.name,
    email: input.email ?? undefined,
    metadata: { organizationId: input.organization.id },
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organization.id}, TRUE)`;
    await tx.organization.update({
      where: { id: input.organization.id },
      data: { stripeCustomerId: customer.id },
    });
  });
  return customer.id;
}

/** Stripe Checkout für Pro/Business starten (nur OWNER). */
export async function createCheckoutAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/registrieren");

  const { organization, userId } = await requireOrg("OWNER");

  const parsed = checkoutSchema.safeParse({
    tier: formData.get("tier"),
    interval: formData.get("interval"),
  });
  if (!parsed.success) return { error: "Ungültige Auswahl." };

  const stripe = getStripe();
  if (!stripe) {
    return {
      error:
        "Stripe ist in dieser Umgebung nicht konfiguriert (STRIPE_SECRET_KEY fehlt).",
    };
  }
  const priceId = priceIdFor(parsed.data.tier, parsed.data.interval);
  if (!priceId) {
    return {
      error: `Keine Stripe-Price-ID für ${parsed.data.tier}/${parsed.data.interval} hinterlegt.`,
    };
  }

  const customerId = await ensureStripeCustomer({
    stripe,
    organization,
    email: session.user.email,
  });

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        organizationId: organization.id,
        billingKind: "BASE",
        tier: parsed.data.tier,
      },
    },
    metadata: {
      organizationId: organization.id,
      billingKind: "BASE",
      tier: parsed.data.tier,
    },
    success_url: `${baseUrl()}/einstellungen?checkout=erfolgreich`,
    cancel_url: `${baseUrl()}/pricing?checkout=abgebrochen`,
    locale: "de",
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "billing.checkout_start",
    entityType: "Organization",
    entityId: organization.id,
    after: { tier: parsed.data.tier, interval: parsed.data.interval },
  });

  if (!checkout.url) return { error: "Stripe-Checkout konnte nicht erstellt werden." };
  redirect(checkout.url);
}

/** Stripe-Kundenportal für die Abo-Verwaltung öffnen (nur OWNER). */
export async function createPortalAction(): Promise<ActionState> {
  const { organization } = await requireOrg("OWNER");

  const stripe = getStripe();
  if (!stripe) {
    return {
      error:
        "Stripe ist in dieser Umgebung nicht konfiguriert (STRIPE_SECRET_KEY fehlt).",
    };
  }
  if (!organization.stripeCustomerId) {
    return { error: "Noch kein Abo vorhanden – zuerst einen Plan wählen." };
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: `${baseUrl()}/einstellungen`,
  });

  redirect(portal.url);
}

/** Separates Stripe Checkout for the consignment add-on from the base plan. */
export async function createConsignmentAddonCheckoutAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) redirect("/registrieren");

  const context = await requireOrg("OWNER");
  const { organization, userId, db } = context;
  const parsed = addonCheckoutSchema.safeParse({
    interval: formData.get("interval"),
  });
  if (!parsed.success) return { error: "Ungueltiges Abrechnungsintervall." };

  const access = await getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT);
  const stripeGrant = access.grantId
    ? await db.featureEntitlement.findUnique({
        where: { id: access.grantId },
        select: { stripeSubscriptionId: true },
      })
    : null;
  if (
    access.enabled &&
    (access.source !== "TRIAL" || Boolean(stripeGrant?.stripeSubscriptionId))
  ) {
    return {
      error:
        "Konsignation ist bereits aktiviert. Ein Stripe-Abo kann im Kundenportal verwaltet werden.",
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      error:
        "Stripe ist in dieser Umgebung nicht konfiguriert (STRIPE_SECRET_KEY fehlt).",
    };
  }
  const priceId = consignmentPriceIdFor(parsed.data.interval);
  if (!priceId) {
    return {
      error: `Keine Stripe-Price-ID fuer das Konsignations-Add-on/${parsed.data.interval} hinterlegt.`,
    };
  }

  const customerId = await ensureStripeCustomer({
    stripe,
    organization,
    email: session.user.email,
  });

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        organizationId: organization.id,
        billingKind: "ADD_ON",
        featureKey: FEATURE_KEYS.CONSIGNMENT,
      },
    },
    metadata: {
      organizationId: organization.id,
      billingKind: "ADD_ON",
      featureKey: FEATURE_KEYS.CONSIGNMENT,
    },
    success_url: `${baseUrl()}/einstellungen?addon=erfolgreich`,
    cancel_url: `${baseUrl()}/pricing?addon=abgebrochen`,
    locale: "de",
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "billing.consignment_addon_checkout_start",
    entityType: "FeatureEntitlement",
    after: { interval: parsed.data.interval },
  });

  if (!checkout.url) {
    return { error: "Stripe-Checkout konnte nicht erstellt werden." };
  }
  redirect(checkout.url);
}

/** Starts the one-time in-app trial without requiring Stripe configuration. */
export async function startConsignmentTrialAction(
  ...args: [ActionState, FormData]
): Promise<ActionState> {
  void args;
  const { organization, userId } = await requireOrg("OWNER");
  const now = new Date();
  const days = configuredConsignmentTrialDays();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:entitlement-trial:${organization.id}:${FEATURE_KEYS.CONSIGNMENT}`}))`;
    const grants = await tx.featureEntitlement.findMany({
      where: {
        organizationId: organization.id,
        featureKey: FEATURE_KEYS.CONSIGNMENT,
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
    const eligibility = getConsignmentTrialEligibility({
      organizationId: organization.id,
      subscriptionTier: organization.subscriptionTier,
      grants,
      now,
    });
    if (!eligibility.eligible) return eligibility;

    const entitlement = await tx.featureEntitlement.create({
      data: {
        organizationId: organization.id,
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        status: "ACTIVE",
        source: "TRIAL",
        startsAt: now,
        endsAt,
        metadata: { trialDays: days, origin: "self_service" },
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId,
        action: "billing.consignment_trial_start",
        entityType: "FeatureEntitlement",
        entityId: entitlement.id,
        after: { startsAt: now.toISOString(), endsAt: endsAt.toISOString() },
      },
    });
    return eligibility;
  });

  if (!result.eligible) {
    return {
      error:
        result.reason === "TRIAL_ALREADY_USED"
          ? "Die Konsignations-Testphase wurde bereits genutzt."
          : "Konsignation ist fuer diese Organisation bereits aktiviert.",
    };
  }

  revalidatePath("/konsignation");
  revalidatePath("/einstellungen");
  return { success: `Konsignation ist fuer ${days} Tage freigeschaltet.` };
}

/** Internal manual enablement through an environment-provided code. */
export async function redeemConsignmentAddonCodeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("OWNER");
  const configuredCode = process.env.CONSIGNMENT_ADDON_MANUAL_CODE?.trim();
  if (!configuredCode) {
    return {
      error: "Die manuelle Add-on-Freischaltung ist nicht konfiguriert.",
    };
  }

  const parsed = planCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltiger Code." };
  }
  if (parsed.data.code !== configuredCode) {
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "billing.consignment_addon_code_invalid",
      entityType: "FeatureEntitlement",
    });
    return { error: "Code ist ungueltig." };
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:entitlement-manual:${organization.id}:${FEATURE_KEYS.CONSIGNMENT}`}))`;
    const grants = await tx.featureEntitlement.findMany({
      where: {
        organizationId: organization.id,
        featureKey: FEATURE_KEYS.CONSIGNMENT,
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
    const currentAccess = evaluateFeatureEntitlement({
      organizationId: organization.id,
      featureKey: FEATURE_KEYS.CONSIGNMENT,
      grants,
      subscriptionTier: organization.subscriptionTier,
    });
    if (currentAccess.enabled) return false;

    const entitlement = await tx.featureEntitlement.create({
      data: {
        organizationId: organization.id,
        featureKey: FEATURE_KEYS.CONSIGNMENT,
        status: "ACTIVE",
        source: "MANUAL",
        metadata: { origin: "internal_code" },
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId,
        action: "billing.consignment_addon_manual_enable",
        entityType: "FeatureEntitlement",
        entityId: entitlement.id,
        after: { source: "MANUAL" },
      },
    });
    return true;
  });

  revalidatePath("/konsignation");
  revalidatePath("/einstellungen");
  return {
    success: created
      ? "Konsignations-Add-on wurde manuell aktiviert."
      : "Konsignation war bereits aktiviert; es wurde nichts geändert.",
  };
}

/** Demo-/Lizenzcode einloesen und den Organisationsplan setzen (nur OWNER). */
export async function redeemPlanCodeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await requireOrg("OWNER");

  const configuredCode = process.env.DEMO_UPGRADE_CODE?.trim();
  if (!configuredCode) {
    return { error: "Plan-Code-Funktion ist in dieser Umgebung nicht konfiguriert." };
  }

  const parsed = planCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltiger Code." };
  }

  if (parsed.data.code !== configuredCode) {
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "billing.code_invalid",
      entityType: "Organization",
      entityId: organization.id,
    });
    return { error: "Code ist ungueltig." };
  }

  const targetTier = parseDemoTier(process.env.DEMO_UPGRADE_TIER);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    await tx.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionTier: targetTier,
        stripeSubscriptionId: null,
      },
    });
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "billing.code_redeem",
    entityType: "Organization",
    entityId: organization.id,
    before: { tier: organization.subscriptionTier },
    after: { tier: targetTier },
  });

  await updateSession({});
  revalidatePath("/einstellungen");
  revalidatePath("/pricing");

  return { success: `Plan wurde auf ${targetTier} gesetzt.` };
}

function parseDemoTier(value: string | undefined): SubscriptionTier {
  if (value === "PRO" || value === "BUSINESS") return value;
  return "BUSINESS";
}
