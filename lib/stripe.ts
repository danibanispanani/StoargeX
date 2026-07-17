import Stripe from "stripe";
import type { SubscriptionTier } from "@prisma/client";
import type { BillingPriceCatalog } from "@/lib/services/billing-entitlement-service";

// Stripe-Client (nur server-seitig). Ohne STRIPE_SECRET_KEY liefern die
// Billing-Actions eine verständliche Fehlermeldung statt zu crashen.

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}

const PRICE_ENV: Record<string, string | undefined> = {
  "PRO:monthly": process.env.STRIPE_PRICE_PRO_MONTHLY,
  "PRO:yearly": process.env.STRIPE_PRICE_PRO_YEARLY,
  "BUSINESS:monthly": process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  "BUSINESS:yearly": process.env.STRIPE_PRICE_BUSINESS_YEARLY,
};

const CONSIGNMENT_PRICE_ENV: Record<
  "monthly" | "yearly",
  string | undefined
> = {
  monthly: process.env.STRIPE_PRICE_CONSIGNMENT_MONTHLY,
  yearly: process.env.STRIPE_PRICE_CONSIGNMENT_YEARLY,
};

export function priceIdFor(
  tier: "PRO" | "BUSINESS",
  interval: "monthly" | "yearly"
): string | undefined {
  return PRICE_ENV[`${tier}:${interval}`];
}

/** Price-ID -> Tier (für den Webhook). */
export function tierForPriceId(priceId: string): SubscriptionTier | null {
  for (const [key, value] of Object.entries(PRICE_ENV)) {
    if (value && value === priceId) {
      return key.startsWith("BUSINESS") ? "BUSINESS" : "PRO";
    }
  }
  return null;
}

export function consignmentPriceIdFor(
  interval: "monthly" | "yearly"
): string | undefined {
  return CONSIGNMENT_PRICE_ENV[interval];
}

export function isConsignmentPriceId(priceId: string): boolean {
  return Object.values(CONSIGNMENT_PRICE_ENV).some(
    (configured) => configured === priceId
  );
}

export function billingPriceCatalog(): BillingPriceCatalog {
  const base: Record<string, "PRO" | "BUSINESS"> = {};
  for (const [key, priceId] of Object.entries(PRICE_ENV)) {
    if (priceId) {
      base[priceId] = key.startsWith("BUSINESS") ? "BUSINESS" : "PRO";
    }
  }

  return {
    base,
    consignment: new Set(
      Object.values(CONSIGNMENT_PRICE_ENV).filter(
        (priceId): priceId is string => Boolean(priceId)
      )
    ),
  };
}
