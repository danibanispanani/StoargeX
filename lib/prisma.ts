import { PrismaClient } from "@prisma/client";

// Basis-Client OHNE Tenant-Kontext. Durch die RLS-Policies (FORCE ROW LEVEL
// SECURITY) liefert er auf mandantenspezifischen Tabellen KEINE Zeilen,
// solange kein Kontext gesetzt ist. Für Auth-/Registrierungsflows, die vor
// dem Org-Kontext laufen (Login, Einladung annehmen), gibt es bypassDb().
//
// Für alle Geschäftsdaten IMMER tenantDb(orgId) aus lib/tenant-db.ts verwenden.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Client mit RLS-Bypass (app.bypass_rls = 'on') für Systemoperationen, die
 * organisationsübergreifend arbeiten müssen: Login (Memberships laden),
 * Registrierung (Organization anlegen), Einladung per Token auflösen.
 * NIEMALS für Requests verwenden, die Nutzereingaben zu Geschäftsdaten ausführen.
 */
export function bypassDb() {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
