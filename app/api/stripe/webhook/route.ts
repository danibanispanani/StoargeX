import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe, tierForPriceId } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";

// Stripe-Webhook: hält organization.subscription_tier aktuell.
// Signaturprüfung mit STRIPE_WEBHOOK_SECRET ist Pflicht – ohne gültige
// Signatur wird nichts verarbeitet.

async function setTier(
  organizationId: string,
  tier: SubscriptionTier,
  subscriptionId: string | null
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    await tx.organization.update({
      where: { id: organizationId },
      data: { subscriptionTier: tier, stripeSubscriptionId: subscriptionId },
    });
  });
  await writeAuditLog({
    organizationId,
    action: "billing.tier_change",
    entityType: "Organization",
    entityId: organizationId,
    after: { tier },
  });
}

async function orgIdForCustomer(customerId: string): Promise<string | null> {
  const orgs = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    return tx.organization.findMany({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
  });
  return orgs[0]?.id ?? null;
}

function subscriptionTier(subscription: Stripe.Subscription): SubscriptionTier {
  const active = subscription.status === "active" || subscription.status === "trialing";
  if (!active) return "FREE";
  const priceId = subscription.items.data[0]?.price?.id;
  return (priceId && tierForPriceId(priceId)) || "FREE";
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const organizationId = session.metadata?.organizationId;
      if (organizationId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          String(session.subscription)
        );
        await setTier(organizationId, subscriptionTier(subscription), subscription.id);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const organizationId =
        subscription.metadata?.organizationId ??
        (await orgIdForCustomer(String(subscription.customer)));
      if (organizationId) {
        await setTier(organizationId, subscriptionTier(subscription), subscription.id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const organizationId =
        subscription.metadata?.organizationId ??
        (await orgIdForCustomer(String(subscription.customer)));
      if (organizationId) {
        await setTier(organizationId, "FREE", null);
      }
      break;
    }
    default:
      break; // andere Events bewusst ignorieren
  }

  return NextResponse.json({ received: true });
}
