import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("consignment route gate", () => {
  const source = readFileSync(
    "app/(app)/konsignation/page.tsx",
    "utf8"
  );

  it("checks entitlement before loading retained domain data", () => {
    const accessCheck = source.indexOf(
      "getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT)"
    );
    const gateReturn = source.indexOf("if (!access.enabled)");
    const firstDomainQuery = source.indexOf("db.inventoryPosition.findMany");

    expect(accessCheck).toBeGreaterThan(-1);
    expect(gateReturn).toBeGreaterThan(accessCheck);
    expect(firstDomainQuery).toBeGreaterThan(gateReturn);
    expect(source).toContain(
      'ctaHref="/pricing?feature=Konsignation#konsignation-addon"'
    );
  });
});
