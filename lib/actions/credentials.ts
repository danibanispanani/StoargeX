"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { envelopeDecrypt, envelopeEncrypt } from "@/lib/crypto";
import type { ActionState } from "@/lib/actions/team";

// Zugriff auf den Tresor nur für Rollen mit expliziter Berechtigung:
// OWNER und ADMIN (requireOrg("ADMIN")). Secrets verlassen den Server nur
// über revealCredentialAction – und jeder Abruf landet im Audit-Log.

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}

const credentialSchema = z.object({
  label: z.string().min(1, "Label fehlt.").max(200),
  username: z.string().max(200).optional().or(z.literal("")),
  secret: z.string().min(1, "Secret fehlt.").max(5000),
  platformId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/** Zugangsdaten verschlüsselt ablegen (AES-256 Envelope Encryption). */
export async function createCredentialAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = credentialSchema.safeParse({
    label: formData.get("label"),
    username: formData.get("username"),
    secret: formData.get("secret"),
    platformId: formData.get("platformId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  if (data.platformId) {
    const platform = await db.platform.findFirst({ where: { id: data.platformId } });
    if (!platform) return { error: "Plattform nicht gefunden." };
  }

  const credential = await db.credential.create({
    data: {
      organizationId: organization.id,
      label: data.label,
      username: data.username || null,
      secretEncrypted: envelopeEncrypt(data.secret),
      platformId: data.platformId || null,
      notes: data.notes || null,
      lastRotatedAt: new Date(),
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "credential.create",
    entityType: "Credential",
    entityId: credential.id,
    after: { label: credential.label }, // niemals das Secret loggen
    ipAddress: await clientIp(),
  });

  revalidatePath("/zugangsdaten");
  return { success: `Zugangsdaten "${credential.label}" gespeichert.` };
}

export type RevealResult = { secret: string } | { error: string };

/**
 * Secret server-seitig entschlüsseln und einmalig ausliefern.
 * Jeder Abruf wird mit Nutzer und IP im Audit-Log protokolliert.
 */
export async function revealCredentialAction(
  credentialId: string
): Promise<RevealResult> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const parsed = z.string().min(1).max(50).safeParse(credentialId);
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const credential = await db.credential.findFirst({
    where: { id: parsed.data },
  });
  if (!credential) return { error: "Eintrag nicht gefunden." };

  let secret: string;
  try {
    secret = envelopeDecrypt(credential.secretEncrypted);
  } catch {
    return { error: "Entschlüsselung fehlgeschlagen (Schlüssel geändert?)." };
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "credential.reveal",
    entityType: "Credential",
    entityId: credential.id,
    after: { label: credential.label },
    ipAddress: await clientIp(),
  });

  return { secret };
}

/** Zugangsdaten löschen (nur OWNER/ADMIN). */
export async function deleteCredentialAction(
  credentialId: string
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const credential = await db.credential.findFirst({ where: { id: credentialId } });
  if (!credential) return { error: "Eintrag nicht gefunden." };

  await db.credential.delete({ where: { id: credentialId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "credential.delete",
    entityType: "Credential",
    entityId: credentialId,
    before: { label: credential.label },
    ipAddress: await clientIp(),
  });

  revalidatePath("/zugangsdaten");
  return { success: "Eintrag gelöscht." };
}
