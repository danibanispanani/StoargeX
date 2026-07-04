import { authenticator } from "otplib";
import { encrypt, decrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";

// Toleranz: 1 Zeitfenster (30s) vor/zurück gegen Uhren-Drift
authenticator.options = { window: 1 };

export function generateTotpSecret(): { secret: string; encrypted: string } {
  const secret = authenticator.generateSecret();
  return { secret, encrypted: encrypt(secret) };
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, "StoargeX", secret);
}

export function verifyTotpCode(code: string, encryptedSecret: string): boolean {
  try {
    return authenticator.check(code.replace(/\s/g, ""), decrypt(encryptedSecret));
  } catch {
    return false;
  }
}

/** 10 Einmal-Wiederherstellungscodes im Format XXXX-XXXX (Klartext nur einmalig anzeigen!) */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}
