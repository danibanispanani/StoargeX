"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

const checkoutSchema = z.object({
  tier: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["monthly", "yearly"]),
});

function baseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
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

  // Kunden anlegen oder wiederverwenden
  let customerId = organization.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: organization.name,
      email: session.user.email ?? undefined,
      metadata: { organizationId: organization.id },
    });
    customerId = customer.id;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
      await tx.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId: customerId },
      });
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { organizationId: organization.id } },
    metadata: { organizationId: organization.id },
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
