import { beforeAll, describe, expect, it } from "vitest";

// Test-Master-Key setzen, bevor die Krypto-Funktionen benutzt werden
beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
});

describe("crypto", () => {
  it("encrypt/decrypt Roundtrip (Master-Key)", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const secret = "mein-super-geheimes-passwort-äöü-🔑";
    const payload = encrypt(secret);
    expect(payload).not.toContain(secret);
    expect(decrypt(payload)).toBe(secret);
  });

  it("encrypt erzeugt bei gleichem Klartext unterschiedliche Chiffrate (zufällige IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    expect(encrypt("gleich")).not.toBe(encrypt("gleich"));
  });

  it("envelopeEncrypt/envelopeDecrypt Roundtrip", async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import("@/lib/crypto");
    const secret = "ebay-api-token-XYZ123!";
    const payload = envelopeEncrypt(secret);
    expect(payload.startsWith("env1:")).toBe(true);
    expect(payload).not.toContain(secret);
    expect(envelopeDecrypt(payload)).toBe(secret);
  });

  it("envelope: pro Secret ein eigener DEK (unterschiedliche Chiffrate)", async () => {
    const { envelopeEncrypt } = await import("@/lib/crypto");
    const a = envelopeEncrypt("gleich");
    const b = envelopeEncrypt("gleich");
    expect(a).not.toBe(b);
    // auch der verschlüsselte DEK unterscheidet sich
    expect(a.split(":")[1]).not.toBe(b.split(":")[1]);
  });

  it("envelopeDecrypt lehnt manipulierte Chiffrate ab (GCM-Auth-Tag)", async () => {
    const { envelopeEncrypt, envelopeDecrypt } = await import("@/lib/crypto");
    const payload = envelopeEncrypt("original");
    const tampered = payload.slice(0, -2) + (payload.endsWith("00") ? "11" : "00");
    expect(() => envelopeDecrypt(tampered)).toThrow();
  });

  it("envelopeDecrypt lehnt fremde Formate ab", async () => {
    const { envelopeDecrypt } = await import("@/lib/crypto");
    expect(() => envelopeDecrypt("quatsch")).toThrow();
    expect(() => envelopeDecrypt("env2:a.b.c:d.e.f")).toThrow();
  });
});
