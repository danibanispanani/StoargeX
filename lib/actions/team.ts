"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { sendInvitationMail } from "@/lib/mail";
import { ROLE_LABELS } from "@/lib/roles";

export type ActionState = { error?: string; success?: string } | null;

const inviteSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse."),
  role: z.nativeEnum(Role),
});

/** Einladung per E-Mail mit Rollenauswahl (nur OWNER/ADMIN). */
export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, membership, userId } = await requireOrg("ADMIN");

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role;

  // Nur OWNER darf weitere OWNER einladen
  if (role === "OWNER" && membership.role !== "OWNER") {
    return { error: "Nur Inhaber können weitere Inhaber einladen." };
  }

  // Bereits Mitglied? (User-Lookup ist global, Membership-Check im Tenant-Kontext)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.membership.findFirst({
      where: { userId: existingUser.id },
    });
    if (existingMembership) {
      return { error: "Diese Person ist bereits Mitglied der Organisation." };
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Tage

  await db.invitation.upsert({
    where: {
      organizationId_email: { organizationId: organization.id, email },
    },
    create: {
      organizationId: organization.id,
      email,
      role,
      token,
      invitedById: userId,
      expiresAt,
    },
    update: { role, token, invitedById: userId, expiresAt, status: "PENDING", acceptedAt: null },
  });

  const inviter = await prisma.user.findUnique({ where: { id: userId } });
  await sendInvitationMail({
    to: email,
    organizationName: organization.name,
    inviterName: inviter?.name ?? inviter?.email ?? "Ein Mitglied",
    role: ROLE_LABELS[role],
    token,
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "member.invite",
    entityType: "Invitation",
    after: { email, role },
  });

  revalidatePath("/team");
  return { success: `Einladung an ${email} versendet.` };
}

/** Einladung zurückziehen (nur OWNER/ADMIN). */
export async function revokeInvitationAction(invitationId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("ADMIN");

  const invitation = await db.invitation.findFirst({ where: { id: invitationId } });
  if (!invitation) return { error: "Einladung nicht gefunden." };

  await db.invitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "member.invite_revoke",
    entityType: "Invitation",
    entityId: invitationId,
    before: { email: invitation.email },
  });

  revalidatePath("/team");
  return { success: "Einladung zurückgezogen." };
}

/** Rolle eines Mitglieds ändern (nur OWNER/ADMIN, letzter OWNER geschützt). */
export async function updateMemberRoleAction(
  membershipId: string,
  newRole: Role
): Promise<ActionState> {
  const { db, organization, membership: actor, userId } = await requireOrg("ADMIN");

  const target = await db.membership.findFirst({ where: { id: membershipId } });
  if (!target) return { error: "Mitglied nicht gefunden." };

  // ADMIN darf keine OWNER verwalten und niemanden zum OWNER machen
  if (actor.role !== "OWNER" && (target.role === "OWNER" || newRole === "OWNER")) {
    return { error: "Nur Inhaber können Inhaber-Rollen verwalten." };
  }

  // Der letzte OWNER darf nicht herabgestuft werden
  if (target.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await db.membership.count({ where: { role: "OWNER" } });
    if (ownerCount <= 1) {
      return { error: "Die Organisation braucht mindestens einen Inhaber." };
    }
  }

  await db.membership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "member.role_change",
    entityType: "Membership",
    entityId: membershipId,
    before: { role: target.role },
    after: { role: newRole },
  });

  revalidatePath("/team");
  return { success: "Rolle aktualisiert." };
}

/** Mitglied entfernen (nur OWNER/ADMIN, letzter OWNER geschützt). */
export async function removeMemberAction(membershipId: string): Promise<ActionState> {
  const { db, organization, membership: actor, userId } = await requireOrg("ADMIN");

  const target = await db.membership.findFirst({ where: { id: membershipId } });
  if (!target) return { error: "Mitglied nicht gefunden." };
  if (target.userId === userId) {
    return { error: "Du kannst dich nicht selbst entfernen." };
  }
  if (actor.role !== "OWNER" && target.role === "OWNER") {
    return { error: "Nur Inhaber können Inhaber entfernen." };
  }
  if (target.role === "OWNER") {
    const ownerCount = await db.membership.count({ where: { role: "OWNER" } });
    if (ownerCount <= 1) {
      return { error: "Die Organisation braucht mindestens einen Inhaber." };
    }
  }

  await db.membership.delete({ where: { id: membershipId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "member.remove",
    entityType: "Membership",
    entityId: membershipId,
    before: { userId: target.userId, role: target.role },
  });

  revalidatePath("/team");
  return { success: "Mitglied entfernt." };
}
