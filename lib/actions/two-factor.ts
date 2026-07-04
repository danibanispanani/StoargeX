"use server";

import argon2 from "argon2";
import QRCode from "qrcode";
import { z } from "zod";
import { auth, updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bypassDb } from "@/lib/prisma";
import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/totp";
import { requiresTwoFactor } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

export type TotpSetupState =
  | { qrDataUrl: string; secret: string; encrypted: string }
  | { error: string };

export type TotpConfirmState =
  | { recoveryCodes: string[] }
  | { error?: string }
  | null;

/** Schritt 1: Secret erzeugen und QR-Code fürs Authenticator-Setup liefern. */
export async function startTotpSetupAction(): Promise<TotpSetupState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Nicht eingeloggt." };
  }
  if (session.user.totpEnabled) {
    return { error: "2FA ist bereits aktiviert." };
  }

  const { secret, encrypted } = generateTotpSecret();
  const otpAuthUrl = buildOtpAuthUrl(session.user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 240 });

  // Secret verschlüsselt zwischenspeichern; aktiv wird 2FA erst nach Bestätigung
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: encrypted, totpEnabled: false },
  });

  return { qrDataUrl, secret, encrypted };
}

const confirmSchema = z.object({ code: z.string().min(6).max(8) });

/** Schritt 2: Ersten Code prüfen, 2FA aktivieren, Recovery-Codes ausgeben. */
export async function confirmTotpSetupAction(
  _prev: TotpConfirmState,
  formData: FormData
): Promise<TotpConfirmState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht eingeloggt." };

  const parsed = confirmSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Bitte einen gültigen Code eingeben." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.totpSecret) {
    return { error: "Kein 2FA-Setup gestartet. Bitte neu beginnen." };
  }
  if (!verifyTotpCode(parsed.data.code, user.totpSecret)) {
    return { error: "Der Code ist ungültig. Bitte erneut versuchen." };
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashes = await Promise.all(
    recoveryCodes.map((c) => argon2.hash(c, { type: argon2.argon2id }))
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, recoveryCodes: hashes },
  });

  // Audit-Log in allen Organisationen des Users
  const memberships = await bypassDb().membership.findMany({
    where: { userId: user.id },
  });
  await Promise.all(
    memberships.map((m) =>
      writeAuditLog({
        organizationId: m.organizationId,
        userId: user.id,
        action: "user.2fa_enable",
        entityType: "User",
        entityId: user.id,
      })
    )
  );

  // Session-JWT auffrischen (totpEnabled-Claim), sonst greift die Middleware weiter
  await updateSession({});

  return { recoveryCodes };
}

const disableSchema = z.object({ code: z.string().min(6).max(10) });

/** 2FA deaktivieren – für OWNER/ADMIN nicht erlaubt (Pflicht-2FA). */
export async function disableTotpAction(
  _prev: TotpConfirmState,
  formData: FormData
): Promise<TotpConfirmState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht eingeloggt." };

  const memberships = await bypassDb().membership.findMany({
    where: { userId: session.user.id },
  });
  if (memberships.some((m) => requiresTwoFactor(m.role))) {
    return {
      error: "Als Inhaber oder Administrator ist 2FA verpflichtend und kann nicht deaktiviert werden.",
    };
  }

  const parsed = disableSchema.safeParse({ code: formData.get("code") });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.totpSecret || !user.totpEnabled) {
    return { error: "2FA ist nicht aktiviert." };
  }
  if (!parsed.success || !verifyTotpCode(parsed.data.code, user.totpSecret)) {
    return { error: "Der Code ist ungültig." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, recoveryCodes: [] },
  });

  await Promise.all(
    memberships.map((m) =>
      writeAuditLog({
        organizationId: m.organizationId,
        userId: user.id,
        action: "user.2fa_disable",
        entityType: "User",
        entityId: user.id,
      })
    )
  );

  await updateSession({});
  return { error: undefined };
}
