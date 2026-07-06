import type { OptionKind } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYOUT_RECIPIENTS,
  DEFAULT_TASK_AREAS,
} from "@/lib/constants";

const DEFAULTS: Record<OptionKind, string[]> = {
  PAYMENT_METHOD: DEFAULT_PAYMENT_METHODS,
  PAYOUT_RECIPIENT: DEFAULT_PAYOUT_RECIPIENTS,
  TASK_AREA: DEFAULT_TASK_AREAS,
};

/**
 * Liefert die konfigurierten Dropdown-Werte einer Organisation.
 * Existieren noch keine (Bestandsorganisationen), werden die Standardwerte
 * einmalig angelegt (Lazy Seed).
 */
export async function getOptions(
  db: TenantDb,
  organizationId: string,
  kind: OptionKind
): Promise<string[]> {
  let options = await db.selectOption.findMany({
    where: { kind, active: true },
    orderBy: { sortOrder: "asc" },
  });

  if (options.length === 0) {
    await db.selectOption.createMany({
      data: DEFAULTS[kind].map((label, index) => ({
        organizationId,
        kind,
        label,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
    options = await db.selectOption.findMany({
      where: { kind, active: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  return options.map((o) => o.label);
}
