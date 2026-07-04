import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM für ruhende Geheimnisse (TOTP-Secrets, Plattform-Credentials).
// Format: <iv hex>.<authTag hex>.<ciphertext hex>

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY fehlt oder ist ungültig (erwartet: 64 Hex-Zeichen)."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${authTag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(".");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Ungültiges Chiffrat-Format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
