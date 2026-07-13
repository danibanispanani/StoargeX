import { describe, expect, it } from "vitest";
import {
  isFeeRuleEffective,
  selectEffectiveFeeRule,
  type FeeRuleCandidate,
} from "@/lib/services/fee-rule-service";

const AT = new Date("2026-07-13T12:00:00.000Z");

function rule(overrides: Partial<FeeRuleCandidate> = {}): FeeRuleCandidate {
  return {
    id: "generic",
    organizationId: "org-1",
    platformId: "platform-1",
    marketplaceAccountId: null,
    category: null,
    itemCondition: null,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: null,
    priority: 0,
    active: true,
    ...overrides,
  };
}

describe("fee rule validity", () => {
  it("verwendet ein halboffenes Gültigkeitsintervall", () => {
    expect(isFeeRuleEffective(rule(), { organizationId: "org-1", platformId: "platform-1", at: AT })).toBe(true);
    expect(
      isFeeRuleEffective(rule({ validUntil: AT }), {
        organizationId: "org-1",
        platformId: "platform-1",
        at: AT,
      })
    ).toBe(false);
  });

  it("isoliert Regeln nach Tenant, Plattform, Konto, Kategorie und Zustand", () => {
    const scoped = rule({
      marketplaceAccountId: "account-1",
      category: "Smartphones",
      itemCondition: "NEW",
    });
    expect(
      isFeeRuleEffective(scoped, {
        organizationId: "org-1",
        platformId: "platform-1",
        marketplaceAccountId: "account-1",
        category: "Smartphones",
        itemCondition: "NEW",
        at: AT,
      })
    ).toBe(true);
    expect(
      isFeeRuleEffective(scoped, {
        organizationId: "org-2",
        platformId: "platform-1",
        marketplaceAccountId: "account-1",
        category: "Smartphones",
        itemCondition: "NEW",
        at: AT,
      })
    ).toBe(false);
  });

  it("wählt Priorität vor Spezifität und danach die neuere Version", () => {
    const selected = selectEffectiveFeeRule(
      [
        rule({ id: "generic", priority: 1 }),
        rule({ id: "specific", priority: 1, category: "Phones" }),
        rule({ id: "priority", priority: 2 }),
      ],
      {
        organizationId: "org-1",
        platformId: "platform-1",
        category: "Phones",
        at: AT,
      }
    );
    expect(selected?.id).toBe("priority");
  });
});
