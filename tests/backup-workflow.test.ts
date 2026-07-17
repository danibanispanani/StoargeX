import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBackupPlan,
  parseBackupConfiguration,
} from "../scripts/backup-policy.mjs";

describe("database backup workflow", () => {
  it("requires a direct database URL and a strong encryption passphrase", () => {
    expect(() => parseBackupConfiguration({})).toThrow(/BACKUP_DATABASE_URL/);
    expect(() => parseBackupConfiguration({
      BACKUP_DATABASE_URL: "postgresql://backup@example.test/db",
      BACKUP_ENCRYPTION_PASSPHRASE: "short",
    })).toThrow(/mindestens 32/);
  });

  it("builds an encrypted custom-format dump with a restore-list verification", () => {
    const config = parseBackupConfiguration({
      BACKUP_DATABASE_URL: "postgresql://backup@example.test/db",
      BACKUP_ENCRYPTION_PASSPHRASE: "a".repeat(32),
      BACKUP_OUTPUT_DIR: "/tmp/storagex-backups",
    });
    const plan = buildBackupPlan(config, new Date("2026-07-17T03:00:00.000Z"));

    expect(plan.dumpArgs).toEqual(expect.arrayContaining([
      "--format=custom",
      "--no-owner",
      "--no-acl",
    ]));
    expect(plan.encryptionArgs).toEqual(expect.arrayContaining([
      "-aes-256-cbc",
      "-pbkdf2",
      "-iter",
      "200000",
    ]));
    expect(plan.verifyRestoreArgs).toContain("--list");
    expect(plan.encryptedFile).toMatch(/storagex-20260717T030000Z\.dump\.enc$/);
  });

  it("schedules daily encrypted backups outside the repository with finite retention", () => {
    const workflow = readFileSync(".github/workflows/database-backup.yml", "utf8");

    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("BACKUP_DATABASE_URL");
    expect(workflow).toContain("BACKUP_ENCRYPTION_PASSPHRASE");
    expect(workflow).toContain("${{ runner.temp }}");
    expect(workflow).toContain("retention-days: 30");
    expect(workflow).toContain("if: failure()");
    expect(workflow).not.toMatch(/uses:\s+actions\/[^@\s]+@v\d+/);
    expect(workflow).not.toContain("public/");
  });
});
