import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM für ruhende Geheimnisse (TOTP-Secrets, Plattform-Credentials).
// Format: <iv hex>.<authTag hex>.<ciphertext hex>
//
// Für den Zugangsdaten-Tresor zusätzlich Envelope Encryption (envelopeEncrypt):
// pro Secret wird ein zufälliger Data Encryption Key (DEK) erzeugt, das Secret
// mit dem DEK verschlüsselt und der DEK selbst mit dem Master-Key
// (APP_ENCRYPTION_KEY) verschlüsselt. Format: env1:<verschl. DEK>:<Chiffrat>
// Vorteil: Der Master-Key kann rotiert werden, indem nur die DEKs neu
// verschlüsselt werden – nicht jedes Secret.

function getMasterKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY fehlt oder ist ungültig (erwartet: 64 Hex-Zeichen)."
    );
  }
  return Buffer.from(hex, "hex");
}

function encryptWithKey(plaintext: Buffer, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${authTag.toString("hex")}.${encrypted.toString("hex")}`;
}

function decryptWithKey(payload: string, key: Buffer): Buffer {
  const [ivHex, tagHex, dataHex] = payload.split(".");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Ungültiges Chiffrat-Format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
}

/** Direkte Verschlüsselung mit dem Master-Key (z.B. TOTP-Secrets). */
export function encrypt(plaintext: string): string {
  return encryptWithKey(Buffer.from(plaintext, "utf8"), getMasterKey());
}

export function decrypt(payload: string): string {
  return decryptWithKey(payload, getMasterKey()).toString("utf8");
}

/**
 * AES-256 Envelope Encryption: Secret mit zufälligem DEK verschlüsseln,
 * DEK mit dem Master-Key verschlüsseln. Nur server-seitig verwenden!
 */
export function envelopeEncrypt(plaintext: string): string {
  const dek = randomBytes(32);
  const ciphertext = encryptWithKey(Buffer.from(plaintext, "utf8"), dek);
  const encryptedDek = encryptWithKey(dek, getMasterKey());
  return `env1:${encryptedDek}:${ciphertext}`;
}

export function envelopeDecrypt(payload: string): string {
  const [version, encryptedDek, ciphertext] = payload.split(":");
  if (version !== "env1" || !encryptedDek || !ciphertext) {
    throw new Error("Ungültiges Envelope-Format.");
  }
  const dek = decryptWithKey(encryptedDek, getMasterKey());
  return decryptWithKey(ciphertext, dek).toString("utf8");
}
