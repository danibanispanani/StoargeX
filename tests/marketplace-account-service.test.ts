import { describe, expect, it } from "vitest";
import {
  MarketplaceAccountResolutionError,
  resolveMarketplaceAccount,
} from "@/lib/services/marketplace-account-service";

const accounts = [
  { id: "a1", organizationId: "org-1", platformId: "p1", displayName: "Shop A", active: true },
  { id: "a2", organizationId: "org-1", platformId: "p1", displayName: "Shop B", active: true },
  { id: "foreign", organizationId: "org-2", platformId: "p1", displayName: "Foreign", active: true },
];

describe("resolveMarketplaceAccount", () => {
  it("löst ein explizites Konto nur im Tenant- und Plattformkontext auf", () => {
    expect(
      resolveMarketplaceAccount({
        organizationId: "org-1",
        platformId: "p1",
        requestedAccountId: "a1",
        accounts,
      })?.id
    ).toBe("a1");
    expect(() =>
      resolveMarketplaceAccount({
        organizationId: "org-1",
        platformId: "p1",
        requestedAccountId: "foreign",
        accounts,
      })
    ).toThrow(MarketplaceAccountResolutionError);
  });

  it("erzwingt bei mehreren aktiven Konten eine explizite Auswahl", () => {
    expect(() =>
      resolveMarketplaceAccount({ organizationId: "org-1", platformId: "p1", accounts })
    ).toThrowError(expect.objectContaining({ code: "AMBIGUOUS_ACCOUNT" }));
  });
});
