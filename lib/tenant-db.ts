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
