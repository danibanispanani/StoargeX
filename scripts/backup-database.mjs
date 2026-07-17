import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { buildBackupPlan, parseBackupConfiguration } from "./backup-policy.mjs";

const configuration = parseBackupConfiguration(process.env);
const plan = buildBackupPlan(configuration);
await mkdir(configuration.outputDir, { recursive: true });

function run(command, args, extraEnvironment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnvironment },
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} wurde mit Exit-Code ${code ?? "unbekannt"} beendet.`));
    });
  });
}

try {
  await run("pg_dump", plan.dumpArgs);
  await run("openssl", plan.encryptionArgs, {
    STORAGEX_BACKUP_PASSPHRASE: configuration.passphrase,
  });
  await run("openssl", plan.decryptionArgs, {
    STORAGEX_BACKUP_PASSPHRASE: configuration.passphrase,
  });
  await run("pg_restore", plan.verifyRestoreArgs);

  const encrypted = await readFile(plan.encryptedFile);
  const digest = createHash("sha256").update(encrypted).digest("hex");
  const size = (await stat(plan.encryptedFile)).size;
  const summary = {
    file: plan.encryptedFile,
    sha256: digest,
    bytes: size,
    verifiedAt: new Date().toISOString(),
    verification: "pg_restore --list",
  };
  console.log(JSON.stringify(summary));

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `file=${plan.encryptedFile}\nsha256=${digest}\nbytes=${size}\n`,
      "utf8"
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## StorageX Datenbankbackup",
        "",
        `- Verifiziert: ${summary.verifiedAt}`,
        `- Größe: ${size} Bytes`,
        `- SHA-256: \`${digest}\``,
        "- Restore-Prüfung: `pg_restore --list` erfolgreich",
        "",
      ].join("\n"),
      "utf8"
    );
  }
} finally {
  await Promise.all([
    rm(plan.dumpFile, { force: true }),
    rm(plan.verificationFile, { force: true }),
  ]);
}
