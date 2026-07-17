import { describe, expect, it } from "vitest";
import { APP_NAVIGATION, findNavigationItem, isNavigationItemActive } from "@/components/layout/app-navigation";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";

describe("app navigation metadata", () => {
  it("groups only existing module routes", () => {
    expect(APP_NAVIGATION.map((section) => section.label)).toEqual([
      "Übersicht",
      "Handel",
      "Retouren",
      "Finanzen",
      "Betrieb",
      "Daten",
      "Verwaltung",
    ]);
    expect(APP_NAVIGATION.flatMap((section) => section.items).map((item) => item.href)).toEqual([
      "/dashboard",
      "/einkauf",
      "/lager",
      "/produkte",
      "/verkauf",
      "/retouren/kunden",
      "/retouren/lieferanten",
      "/finanzen/preisrechner/ebay",
      "/finanzen/preisrechner/kaufland",
      "/finanzen/gebuehren",
      "/finanzen/ausgaben",
      "/schulden",
      "/versand",
      "/konsignation",
      "/aufgaben",
      "/daten/import",
      "/daten/export",
      "/team",
      "/zugangsdaten",
      "/einstellungen/marktplatzkonten",
      "/einstellungen",
    ]);
  });

  it("marks nested pages as part of their module", () => {
    expect(isNavigationItemActive("/einstellungen/sicherheit", "/einstellungen")).toBe(true);
    expect(findNavigationItem("/einstellungen/sicherheit")?.label).toBe("Einstellungen");
    expect(isNavigationItemActive("/lagerbestand", "/lager")).toBe(false);
    expect(findNavigationItem("/retouren/lieferanten")?.label).toBe("Lieferantenretouren");
  });

  it("declares consignment as the add-on-backed navigation item", () => {
    const item = APP_NAVIGATION.flatMap((section) => section.items).find(
      (candidate) => candidate.href === "/konsignation"
    );
    expect(item?.featureKey).toBe(FEATURE_KEYS.CONSIGNMENT);
  });
});
