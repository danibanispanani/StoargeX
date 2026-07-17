import path from "node:path";

const MINIMUM_PASSPHRASE_LENGTH = 32;

export function parseBackupConfiguration(environment, cwd = process.cwd()) {
  const databaseUrl = environment.BACKUP_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("BACKUP_DATABASE_URL fehlt.");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("BACKUP_DATABASE_URL ist keine gültige URL.");
  }
  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new Error("BACKUP_DATABASE_URL muss eine PostgreSQL-Verbindung sein.");
  }

  const passphrase = environment.BACKUP_ENCRYPTION_PASSPHRASE ?? "";
  if (passphrase.length < MINIMUM_PASSPHRASE_LENGTH) {
    throw new Error(
      `BACKUP_ENCRYPTION_PASSPHRASE muss mindestens ${MINIMUM_PASSPHRASE_LENGTH} Zeichen lang sein.`
    );
  }

  const outputDir = path.resolve(
    environment.BACKUP_OUTPUT_DIR?.trim() || path.join(process.env.TEMP || "/tmp", "storagex-backups")
  );
  const repositoryRoot = path.resolve(cwd);
  if (outputDir === repositoryRoot || outputDir.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error("BACKUP_OUTPUT_DIR darf nicht innerhalb des Git-Repositories liegen.");
  }

  return { databaseUrl, passphrase, outputDir };
}

export function buildBackupPlan(configuration, now = new Date()) {
  const timestamp = now.toISOString().replaceAll(/[-:]/g, "").replace(".000", "");
  const basename = `storagex-${timestamp}`;
  const dumpFile = path.join(configuration.outputDir, `${basename}.dump`);
  const encryptedFile = `${dumpFile}.enc`;
  const verificationFile = path.join(configuration.outputDir, `${basename}.verify.dump`);

  return {
    dumpFile,
    encryptedFile,
    verificationFile,
    dumpArgs: [
      "--dbname",
      configuration.databaseUrl,
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      dumpFile,
    ],
    encryptionArgs: [
      "enc",
      "-aes-256-cbc",
      "-salt",
      "-pbkdf2",
      "-iter",
      "200000",
      "-in",
      dumpFile,
      "-out",
      encryptedFile,
      "-pass",
      "env:STORAGEX_BACKUP_PASSPHRASE",
    ],
    decryptionArgs: [
      "enc",
      "-d",
      "-aes-256-cbc",
      "-pbkdf2",
      "-iter",
      "200000",
      "-in",
      encryptedFile,
      "-out",
      verificationFile,
      "-pass",
      "env:STORAGEX_BACKUP_PASSPHRASE",
    ],
    verifyRestoreArgs: ["--list", verificationFile],
  };
}
