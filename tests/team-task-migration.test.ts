import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "prisma/migrations/20260715160000_team_task_management/migration.sql");

describe("team task additive migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("adds snoozing and relational domain links", () => {
    expect(sql).toContain('ADD COLUMN "snoozed_until"');
    expect(sql).toContain('CREATE TABLE "task_domain_links"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  it("requires exactly one type-matching target", () => {
    expect(sql).toContain("task_domain_links_exactly_one_target");
    expect(sql).toContain("task_domain_links_type_matches_target");
  });

  it("protects domain links with tenant RLS", () => {
    expect(sql).toContain('"organization_id" TEXT NOT NULL');
    expect(sql).toContain('ALTER TABLE "task_domain_links" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "task_domain_links" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("app.current_org_id");
    expect(sql).toContain("WITH CHECK");
  });
});
