import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Liefert einen Prisma-Client, der jede Query in einer Transaktion mit
 * gesetztem Tenant-Kontext ausführt:
 *
 *   SELECT set_config('app.current_org_id', <orgId>, TRUE)
 *
 * Die Postgres-RLS-Policies (siehe initiale Migration) filtern damit hart auf
 * organization_id = app.current_org_id – auch bei fehlerhaftem App-Code kann
 * keine fremde Organisation gelesen oder beschrieben werden.
 *
 * set_config(..., TRUE) gilt nur für die aktuelle Transaktion, es kann also
 * nichts auf gepoolte Connections "durchsickern".
 */
export function tenantDb(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
export type TenantReadTransactionDb = Prisma.TransactionClient;

/**
 * Eng begrenzter Kandidat fuer normale Read-Vertraege, die mehrere Abfragen
 * im selben RLS-Kontext ausfuehren. Nicht fuer Writes oder sensitive Pfade.
 */
export async function withTenantReadTransaction<T>(
  organizationId: string,
  task: (db: TenantReadTransactionDb) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return task(tx);
  });
}
