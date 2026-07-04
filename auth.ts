import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import argon2 from "argon2";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma, bypassDb } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";
import type { SessionMembership } from "@/types/next-auth";

// Fehlercodes, die das Login-Formular auswertet:
// "2fa_required" -> TOTP-Feld einblenden, "2fa_invalid" -> Code falsch.
class TwoFactorRequiredError extends CredentialsSignin {
  code = "2fa_required";
}
class TwoFactorInvalidError extends CredentialsSignin {
  code = "2fa_invalid";
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

async function loadMemberships(userId: string): Promise<SessionMembership[]> {
  const memberships = await bypassDb().membership.findMany({
    where: { userId },
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    orgId: m.organizationId,
    orgName: m.organization.name,
    orgSlug: m.organization.slug,
    role: m.role,
  }));
}

/** Prüft einen Wiederherstellungscode und entwertet ihn bei Erfolg. */
async function consumeRecoveryCode(
  userId: string,
  hashes: string[],
  code: string
): Promise<boolean> {
  for (const hash of hashes) {
    if (await argon2.verify(hash, code.trim().toUpperCase()).catch(() => false)) {
      await prisma.user.update({
        where: { id: userId },
        data: { recoveryCodes: hashes.filter((h) => h !== hash) },
      });
      return true;
    }
  }
  return false;
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "E-Mail & Passwort",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        totpCode: { label: "2FA-Code", type: "text" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, totpCode } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        // argon2 auch bei unbekannter E-Mail ausführen (Timing-Angriffe erschweren)
        const dummyHash =
          "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        const passwordOk = await argon2
          .verify(user?.passwordHash ?? dummyHash, password)
          .catch(() => false);
        if (!user?.passwordHash || !passwordOk) return null;

        if (user.totpEnabled) {
          if (!totpCode) throw new TwoFactorRequiredError();
          const totpOk =
            (user.totpSecret && verifyTotpCode(totpCode, user.totpSecret)) ||
            (await consumeRecoveryCode(user.id, user.recoveryCodes, totpCode));
          if (!totpOk) throw new TwoFactorInvalidError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // Beim Login: Claims initial befüllen
      if (user?.id) {
        token.userId = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { totpEnabled: true },
        });
        token.totpEnabled = dbUser?.totpEnabled ?? false;
        token.memberships = await loadMemberships(user.id);
        token.activeOrgId ??= token.memberships[0]?.orgId ?? null;
      }

      // update()-Aufrufe: Org-Wechsel und Refresh nach Rollen-/2FA-Änderungen
      if (trigger === "update") {
        token.memberships = await loadMemberships(token.userId);
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { totpEnabled: true },
        });
        token.totpEnabled = dbUser?.totpEnabled ?? false;

        const requestedOrgId = (session as { activeOrgId?: string } | null)
          ?.activeOrgId;
        if (requestedOrgId) token.activeOrgId = requestedOrgId;
      }

      // Aktive Organisation muss immer einer echten Mitgliedschaft entsprechen
      if (
        token.activeOrgId &&
        !token.memberships?.some((m) => m.orgId === token.activeOrgId)
      ) {
        token.activeOrgId = token.memberships?.[0]?.orgId ?? null;
      }
      if (!token.activeOrgId && token.memberships?.length) {
        token.activeOrgId = token.memberships[0].orgId;
      }

      return token;
    },
  },
});
