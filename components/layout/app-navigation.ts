import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CheckSquare,
  HandCoins,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings2,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/services/feature-entitlement-service";

export interface AppNavigationItem {
  href: string;
  label: string;
  shortLabel?: string;
  Icon: LucideIcon;
  featureKey?: FeatureKey;
}

export interface AppNavigationSection {
  label: string;
  items: readonly AppNavigationItem[];
}

export const APP_NAVIGATION: readonly AppNavigationSection[] = [
  {
    label: "Übersicht",
    items: [{ href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard }],
  },
  {
    label: "Handel",
    items: [
      { href: "/lager", label: "Lager & Wareneingang", shortLabel: "Lager", Icon: Boxes },
      { href: "/produkte", label: "Produkte", Icon: Package },
      { href: "/verkauf", label: "Verkauf", Icon: Tags },
      { href: "/retouren", label: "Kundenretouren", shortLabel: "Retouren", Icon: RotateCcw },
    ],
  },
  {
    label: "Finanzen",
    items: [{ href: "/schulden", label: "Schulden", Icon: HandCoins }],
  },
  {
    label: "Betrieb",
    items: [
      { href: "/versand", label: "Versand", Icon: Truck },
      {
        href: "/konsignation",
        label: "Konsignation",
        Icon: Handshake,
        featureKey: FEATURE_KEYS.CONSIGNMENT,
      },
      { href: "/aufgaben", label: "Aufgaben", Icon: CheckSquare },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/team", label: "Team", Icon: Users },
      { href: "/zugangsdaten", label: "Zugangsdaten", Icon: KeyRound },
      { href: "/einstellungen", label: "Einstellungen", Icon: Settings2 },
    ],
  },
] as const;

export function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavigationItem(pathname: string): AppNavigationItem | undefined {
  return APP_NAVIGATION.flatMap((section) => section.items).find((item) =>
    isNavigationItemActive(pathname, item.href)
  );
}
