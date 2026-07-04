"use server";

import argon2 from "argon2";
import { z } from "zod";
import { redirect } from "next/navigation";
import { auth, signIn, updateSession } from "@/auth";
import { prisma, bypassDb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

/**
 * Einladung per Token auflösen (läuft vor jedem Org-Kontext -> Bypass-Client).
 * Gibt nur Daten für gültige, nicht abgelaufene Einladungen zurück.
 */
export async function getInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const invitation = await bypassDb().invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });
  if (!invitation || invitation.status !== "PENDING") return null;
  if (invitation.expiresAt < new Date()) return null;
  return invitation;
}

const acceptSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  // nur nötig, wenn noch kein Konto existiert:
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(12, "Das Passwort muss mindestens 12 Zeichen lang sein.").max(200).optional(),
});

/**
 * Einladung annehmen. Zwei Fälle:
 * a) eingeloggter User mit passender E-Mail -> Membership anlegen
 * b) kein Konto -> Konto mit Name/Passwort anlegen, dann Membership + Login
 */
export async function acceptInvitationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name") || undefined,
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }

  const invitation = await getInvitation(parsed.data.token);
  if (!invitation) {
    return { error: "Diese Einladung ist ungültig oder abgelaufen." };
  }

  const session = await auth();
  const db = bypassDb();
  let userId: string;
  let loginPassword: string | undefined;

  if (session?.user?.id) {
    // Fall a: eingeloggt – E-Mail muss zur Einladung passen
    if (session.user.email?.toLowerCase() !== invitation.email) {
      return {
        error: `Diese Einladung ist für ${invitation.email}. Bitte melde dich mit diesem Konto an.`,
      };
    }
    userId = session.user.id;
  } else {
    // Fall b: Konto anlegen oder vorhandenes Konto verlangen
    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) {
      return { error: "Für diese E-Mail existiert bereits ein Konto. Bitte melde dich zuerst an." };
    }
    if (!parsed.data.name || !parsed.data.password) {
      return { error: "Bitte Name und Passwort angeben." };
    }
    const passwordHash = await argon2.hash(parsed.data.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    const user = await prisma.user.create({
      data: { email: invitation.email, name: parsed.data.name, passwordHash },
    });
    userId = user.id;
    loginPassword = parsed.data.password;
  }

  await db.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: invitation.organizationId,
        userId,
      },
    },
    create: {
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
    },
    update: {},
  });

  await db.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: invitation.organizationId,
    userId,
    action: "member.invite_accept",
    entityType: "Membership",
    after: { email: invitation.email, role: invitation.role },
  });

  if (loginPassword) {
    await signIn("credentials", {
      email: invitation.email,
      password: loginPassword,
      redirectTo: "/dashboard",
    });
    return null;
  }

  await updateSession({ activeOrgId: invitation.organizationId });
  redirect("/dashboard");
}
