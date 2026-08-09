import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-taugliche Basis-Konfiguration (keine Prisma-/argon2-Importe!).
// Wird von der Middleware UND von auth.ts (voller Server-Kontext) verwendet.
// Session-Strategie: JWT im httpOnly-Cookie (in Produktion zusätzlich Secure,
// __Secure- Präfix); CSRF-Schutz (Double-Submit-Cookie) bringt Auth.js mit.

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
  },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({ allowDangerousEmailAccountLinking: false })]
      : []),
  ],
  callbacks: {
    // Überträgt die JWT-Claims in das Session-Objekt (läuft auch in der Middleware).
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.totpEnabled = token.totpEnabled ?? false;
      session.memberships = token.memberships ?? [];
      session.activeOrgId = token.activeOrgId ?? null;
      const active = session.memberships.find(
        (m) => m.orgId === session.activeOrgId
      );
      session.activeRole = active?.role ?? null;
      session.activeTier = active?.tier ?? null;
      session.readOrgSnapshot = token.readOrgSnapshot ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
