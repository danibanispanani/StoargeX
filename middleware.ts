import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { requiresTwoFactor } from "@/lib/roles";

// Edge-Middleware: verifiziert das Session-JWT (httpOnly-Cookie) und erzwingt:
// 1. eingeloggt auf allen geschützten Routen
// 2. gültige Mitgliedschaft in der aktiven Organisation
// 3. 2FA-Pflicht für OWNER/ADMIN
// Die autoritative Prüfung pro Datenzugriff macht zusätzlich requireOrg()
// (lib/org.ts) direkt gegen die Datenbank + RLS.

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = new Set(["/", "/login", "/registrieren"]);

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/einladung/") ||
    pathname.startsWith("/api/auth")
  );
}

// Routen, die ohne abgeschlossenes 2FA-Setup erreichbar bleiben müssen
function isTwoFactorSetupAllowed(pathname: string): boolean {
  return (
    pathname.startsWith("/einstellungen/sicherheit") ||
    pathname.startsWith("/api/auth")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (isPublic(pathname)) {
    // Eingeloggte Nutzer nicht erneut auf Login/Registrierung schicken
    if (session && (pathname === "/login" || pathname === "/registrieren")) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  // 1. Eingeloggt?
  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Mitglied der angefragten (aktiven) Organisation?
  const membership = session.memberships?.find(
    (m) => m.orgId === session.activeOrgId
  );
  if (!membership) {
    // Nutzer ohne Organisation: erst eine gründen
    return NextResponse.redirect(
      new URL("/registrieren?schritt=organisation", req.nextUrl)
    );
  }

  // 3. 2FA-Pflicht für OWNER/ADMIN
  if (
    requiresTwoFactor(membership.role) &&
    !session.user.totpEnabled &&
    !isTwoFactorSetupAllowed(pathname)
  ) {
    return NextResponse.redirect(
      new URL("/einstellungen/sicherheit?pflicht=1", req.nextUrl)
    );
  }

  return NextResponse.next();
});

export const config = {
  // Alles außer statischen Assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
