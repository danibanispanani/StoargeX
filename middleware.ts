import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { requiresTwoFactor } from "@/lib/roles";
import { GATED_ROUTES, hasTier } from "@/lib/billing";

// Edge-Middleware: verifiziert das Session-JWT (httpOnly-Cookie) und erzwingt:
// 1. eingeloggt auf allen geschützten Routen
// 2. gültige Mitgliedschaft in der aktiven Organisation
// 3. 2FA-Pflicht für OWNER/ADMIN
// Die autoritative Prüfung pro Datenzugriff macht zusätzlich requireOrg()
// (lib/org.ts) direkt gegen die Datenbank + RLS.

const { auth } = NextAuth(authConfig);

// ---------------------------------------------------------------------------
// Rate-Limiting (In-Memory, pro Instanz): Sliding Window pro IP.
// /api/auth/* (Login/Brute-Force) deutlich strenger als der Rest.
// Für horizontales Skalieren später durch Redis/Upstash ersetzen.
// ---------------------------------------------------------------------------

const RATE_LIMITS = {
  auth: { windowMs: 60_000, max: 20 }, // Login & Auth-Endpunkte
  general: { windowMs: 60_000, max: 300 }, // alle übrigen Requests
} as const;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, scope: keyof typeof RATE_LIMITS): boolean {
  const { windowMs, max } = RATE_LIMITS[scope];
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    // gelegentlich abgelaufene Einträge aufräumen
    if (rateBuckets.size > 10_000) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt <= now) rateBuckets.delete(k);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > max;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/registrieren",
  "/pricing",
  "/about",
  "/impressum",
  "/datenschutz",
  "/agb",
]);

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/einladung/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/stripe") // Webhook: Signaturprüfung in der Route
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

  // Rate-Limiting vor allem anderen
  const scope = pathname.startsWith("/api/auth") ? "auth" : "general";
  if (isRateLimited(clientIp(req), scope)) {
    return new NextResponse("Zu viele Anfragen. Bitte kurz warten.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  if (isPublic(pathname)) {
    // Eingeloggte Nutzer nicht erneut auf Login/Registrierung schicken
    // (/pricing bleibt auch eingeloggt erreichbar – für Upgrades)
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

  // 4. Feature-Gating nach Subscription-Tier
  const gated = GATED_ROUTES.find((route) => pathname.startsWith(route.prefix));
  if (gated && !hasTier(membership.tier ?? "FREE", gated.tier)) {
    const upgradeUrl = new URL("/pricing", req.nextUrl);
    upgradeUrl.searchParams.set("feature", gated.label);
    upgradeUrl.searchParams.set("erforderlich", gated.tier);
    return NextResponse.redirect(upgradeUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Alles außer statischen Assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
