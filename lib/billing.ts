import type { SubscriptionTier } from "@prisma/client";

// Tier-Konfiguration (Feature-Matrix nach eigenem Entwurf – "Abschnitt 7"
// des Briefings lag nicht vor; Preise/Features hier zentral anpassbar).

export const TIER_WEIGHT: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 2,
};

export function hasTier(
  current: SubscriptionTier,
  required: SubscriptionTier
): boolean {
  return TIER_WEIGHT[current] >= TIER_WEIGHT[required];
}

export interface TierInfo {
  id: "FREE" | "PRO" | "BUSINESS";
  name: string;
  monthlyCents: number;
  yearlyCents: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const TIERS: TierInfo[] = [
  {
    id: "FREE",
    name: "Free",
    monthlyCents: 0,
    yearlyCents: 0,
    tagline: "Für den Start eurer GbR",
    features: [
      "Lager & Wareneingang",
      "Verkäufe mit Steuer-Automatik",
      "Retouren mit Verlustrechnung",
      "Aufgaben-Board & Schulden",
      "Bis zu 2 Teammitglieder",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    monthlyCents: 1900,
    yearlyCents: 19000,
    tagline: "Für wachsende Teams",
    highlight: true,
    features: [
      "Alles aus Free",
      "Berichte: KPIs, Plattform- & Monatsauswertung",
      "Versandtarife & Kalkulator",
      "Unbegrenzte Teammitglieder",
      "E-Mail-Support",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    monthlyCents: 4900,
    yearlyCents: 49000,
    tagline: "Für professionelle Händler",
    features: [
      "Alles aus Pro",
      "Konsignation (Fremdfirmen-Ware)",
      "Zugangsdaten-Tresor (AES-256)",
      "DSGVO-Export & Audit-Log",
      "Prioritäts-Support",
    ],
  },
];

/** Routen, die ein Mindest-Tier erfordern (Feature-Gating in der Middleware). */
export const GATED_ROUTES: Array<{ prefix: string; tier: SubscriptionTier; label: string }> = [
  { prefix: "/versand", tier: "PRO", label: "Versandtarife" },
  { prefix: "/zugangsdaten", tier: "BUSINESS", label: "Zugangsdaten-Tresor" },
];
