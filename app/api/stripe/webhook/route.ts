import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { billingPriceCatalog, getStripe } from "@/lib/stripe";
import {
  executeIdempotentBillingWebhook,
  type BillingWebhookDependencies,
  type BillingWebhookEventDescriptor,
} from "@/lib/services/billing-webhook-service";
import {
  syncStripeSubscriptionInTransaction,
  type StripeSubscriptionSnapshot,
} from "@/lib/services/stripe-billing-sync-service";
import { configuredConsignmentGraceDays } from "@/lib/billing-config";

const SUPPORTED_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function customerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === "number"
    ? new Date(unixSeconds * 1000)
    : null;
}

async function organizationIdForCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    const organization = await tx.organization.findUnique({
      where: { stripeCustomerId },
      select: { id: true },
    });
    return organization?.id ?? null;
  });
}

function snapshotSubscription(
  subscription: Stripe.Subscription,
  organizationId: string
): StripeSubscriptionSnapshot {
  return {
    id: subscription.id,
    organizationId,
    customerId: customerId(subscription),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEnd: toDate(subscription.trial_end),
    createdAt: new Date(subscription.created * 1000),
    items: subscription.items.data.map((item) => ({
      priceId: item.price.id,
      periodEnd: new Date(item.current_period_end * 1000),
    })),
    metadata: subscription.metadata,
  };
}

async function subscriptionForEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<{
  subscription: Stripe.Subscription;
  checkoutOrganizationId: string | null;
} | null> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (!session.subscription) return null;
    return {
      subscription: await stripe.subscriptions.retrieve(
        String(session.subscription)
      ),
      checkoutOrganizationId: session.metadata?.organizationId ?? null,
    };
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return {
      // Stripe does not guarantee event ordering. Always synchronize the
      // canonical subscription state so a delayed older event cannot restore
      // an entitlement that has already been cancelled or expired.
      subscription: await stripe.subscriptions.retrieve(event.data.object.id),
      checkoutOrganizationId: null,
    };
  }

  return null;
}

function dependenciesFor(
  subscription: StripeSubscriptionSnapshot
): BillingWebhookDependencies<Prisma.TransactionClient> {
  return {
    withEventLock: (eventId, work) =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:stripe-event:${eventId}`}))`;
          return work(tx);
        },
        { timeout: 15_000 }
      ),
    findEvent: async (tx, eventId) => {
      const existing = await tx.billingWebhookEvent.findUnique({
        where: { stripeEventId: eventId },
        select: {
          stripeEventId: true,
          status: true,
          attemptCount: true,
        },
      });
      return existing
        ? {
            eventId: existing.stripeEventId,
            status: existing.status,
            attemptCount: existing.attemptCount,
          }
        : null;
    },
    markProcessing: async (tx, event) => {
      await tx.billingWebhookEvent.upsert({
        where: { stripeEventId: event.id },
        create: {
          stripeEventId: event.id,
          eventType: event.type,
          organizationId: event.organizationId ?? null,
          payloadSummary:
            (event.payloadSummary as Prisma.InputJsonValue | undefined) ?? {},
        },
        update: {
          status: "PROCESSING",
          attemptCount: { increment: 1 },
          errorMessage: null,
          organizationId: event.organizationId ?? null,
          payloadSummary:
            (event.payloadSummary as Prisma.InputJsonValue | undefined) ?? {},
          lastAttemptAt: new Date(),
        },
      });
    },
    apply: async (tx) => {
      await syncStripeSubscriptionInTransaction({
        tx,
        subscription,
        catalog: billingPriceCatalog(),
        now: new Date(),
        gracePeriodDays: configuredConsignmentGraceDays(),
      });
    },
    markProcessed: async (tx, eventId) => {
      await tx.billingWebhookEvent.update({
        where: { stripeEventId: eventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    },
    recordFailure: async (event, errorMessage) => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
        await tx.billingWebhookEvent.upsert({
          where: { stripeEventId: event.id },
          create: {
            stripeEventId: event.id,
            eventType: event.type,
            organizationId: event.organizationId ?? null,
            status: "FAILED",
            errorMessage: errorMessage.slice(0, 2_000),
            payloadSummary:
              (event.payloadSummary as Prisma.InputJsonValue | undefined) ?? {},
          },
          update: {
            status: "FAILED",
            attemptCount: { increment: 1 },
            errorMessage: errorMessage.slice(0, 2_000),
            organizationId: event.organizationId ?? null,
            payloadSummary:
              (event.payloadSummary as Prisma.InputJsonValue | undefined) ?? {},
            lastAttemptAt: new Date(),
          },
        });
      });
    },
  };
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe nicht konfiguriert." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      webhookSecret
    );
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Signatur." },
      { status: 400 }
    );
  }

  if (!SUPPORTED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const resolved = await subscriptionForEvent(stripe, event);
    if (!resolved) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const organizationId =
      resolved.checkoutOrganizationId ??
      resolved.subscription.metadata.organizationId ??
      (await organizationIdForCustomer(customerId(resolved.subscription)));
    if (!organizationId) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const subscription = snapshotSubscription(
      resolved.subscription,
      organizationId
    );
    const descriptor: BillingWebhookEventDescriptor = {
      id: event.id,
      type: event.type,
      organizationId,
      payloadSummary: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        status: subscription.status,
        priceIds: subscription.items.map((item) => item.priceId),
      },
    };
    const result = await executeIdempotentBillingWebhook(
      descriptor,
      dependenciesFor(subscription)
    );

    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[billing] Stripe-Webhook fehlgeschlagen.", error);
    return NextResponse.json(
      { error: "Webhook-Verarbeitung fehlgeschlagen." },
      { status: 500 }
    );
  }
}
