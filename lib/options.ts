import type { OptionKind } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYOUT_RECIPIENTS,
  DEFAULT_STORAGE_LOCATIONS,
  DEFAULT_TASK_AREAS,
} from "@/lib/constants";

const DEFAULTS: Record<OptionKind, string[]> = {
  PAYMENT_METHOD: DEFAULT_PAYMENT_METHODS,
  PAYOUT_RECIPIENT: DEFAULT_PAYOUT_RECIPIENTS,
  TASK_AREA: DEFAULT_TASK_AREAS,
  STORAGE_LOCATION: DEFAULT_STORAGE_LOCATIONS,
};

/**
 * Liefert die konfigurierten Dropdown-Werte einer Organisation.
 * Existieren noch keine (Bestandsorganisationen), werden die Standardwerte
 * einmalig angelegt (Lazy Seed).
 */
export async function getOptions(
  db: TenantDb,
  organizationId: string,
  kind: OptionKind,
  config: { seedMissing?: boolean } = {}
): Promise<string[]> {
  let options = await db.selectOption.findMany({
    where: { kind, active: true },
    orderBy: { sortOrder: "asc" },
  });

  if (options.length === 0 && config.seedMissing !== false) {
    const defaults = DEFAULTS[kind];
    if (defaults.length > 0) {
      await db.selectOption.createMany({
        data: defaults.map((label, index) => ({
          organizationId,
          kind,
          label,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }
    options = await db.selectOption.findMany({
      where: { kind, active: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  return options.map((o) => o.label);
}

export async function getOptionsForKinds(
  db: TenantDb,
  organizationId: string,
  kinds: readonly OptionKind[],
  config: { seedMissing?: boolean } = {}
): Promise<Record<OptionKind, string[]>> {
  const result = emptyOptionsByKind();
  let options = await db.selectOption.findMany({
    where: { organizationId, kind: { in: [...kinds] }, active: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: { kind: true, label: true },
  });

  if (config.seedMissing !== false) {
    const presentKinds = new Set(options.map((option) => option.kind));
    const missingKinds = kinds.filter((kind) => !presentKinds.has(kind));
    const defaults = missingKinds.flatMap((kind) =>
      DEFAULTS[kind].map((label, sortOrder) => ({
        organizationId,
        kind,
        label,
        sortOrder,
      }))
    );
    if (defaults.length > 0) {
      await db.selectOption.createMany({ data: defaults, skipDuplicates: true });
      options = await db.selectOption.findMany({
        where: { organizationId, kind: { in: [...kinds] }, active: true },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
        select: { kind: true, label: true },
      });
    }
  }

  for (const option of options) result[option.kind].push(option.label);
  return result;
}

function emptyOptionsByKind(): Record<OptionKind, string[]> {
  return {
    PAYMENT_METHOD: [],
    PAYOUT_RECIPIENT: [],
    TASK_AREA: [],
    STORAGE_LOCATION: [],
  };
}
