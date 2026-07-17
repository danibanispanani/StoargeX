import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GDPR_REQUIRED_DATASETS } from "@/lib/data-portability/catalog";

describe("GDPR organization export coverage", () => {
  it("loads every required dataset through the tenant-scoped organization data module", () => {
    const source = readFileSync("lib/data-portability/organization-data.ts", "utf8");

    for (const dataset of GDPR_REQUIRED_DATASETS) {
      expect(source, `missing ${dataset}`).toMatch(
        new RegExp(`\\n\\s+${dataset},`)
      );
    }
    expect(source).toContain("TenantDb");
    expect(source).not.toContain("bypassDb");
    expect(source).not.toContain("prisma.");
  });

  it("uses explicit safe projections for invitations, users and credential metadata", () => {
    const source = readFileSync("lib/data-portability/organization-data.ts", "utf8");

    expect(source).toContain("SAFE_INVITATION_SELECT");
    expect(source).toContain("SAFE_USER_SELECT");
    expect(source).toContain("SAFE_CREDENTIAL_SELECT");
    expect(source).not.toMatch(/credential\.findMany\(\s*\)/);
  });
});
