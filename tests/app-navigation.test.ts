import { describe, expect, it } from "vitest";
import { APP_NAVIGATION, findNavigationItem, isNavigationItemActive } from "@/components/layout/app-navigation";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";

describe("app navigation metadata", () => {
  it("groups only existing module routes", () => {
    expect(APP_NAVIGATION.map((section) => section.label)).toEqual([
      "Übersicht",
      "Handel",
      "Finanzen",
      "Betrieb",
      "Verwaltung",
    ]);
    expect(APP_NAVIGATION.flatMap((section) => section.items).map((item) => item.href)).toEqual([
      "/dashboard",
      "/lager",
      "/produkte",
      "/verkauf",
      "/retouren",
      "/schulden",
      "/versand",
      "/konsignation",
      "/aufgaben",
      "/team",
      "/zugangsdaten",
      "/einstellungen",
    ]);
  });

  it("marks nested pages as part of their module", () => {
    expect(isNavigationItemActive("/einstellungen/sicherheit", "/einstellungen")).toBe(true);
    expect(findNavigationItem("/einstellungen/sicherheit")?.label).toBe("Einstellungen");
    expect(isNavigationItemActive("/lagerbestand", "/lager")).toBe(false);
  });

  it("declares consignment as the add-on-backed navigation item", () => {
    const item = APP_NAVIGATION.flatMap((section) => section.items).find(
      (candidate) => candidate.href === "/konsignation"
    );
    expect(item?.featureKey).toBe(FEATURE_KEYS.CONSIGNMENT);
  });
});
