import { queryKeys, type QueryModule } from "@/lib/query/query-keys";

export const MODULE_INVALIDATION_DEPENDENCIES = {
  lager: ["lager", "dashboard"],
  einkauf: ["einkauf", "lager", "dashboard"],
  verkauf: ["verkauf", "lager", "dashboard"],
  produkte: ["produkte", "lager", "einkauf", "verkauf", "reference"],
  dashboard: ["dashboard"],
  reference: ["reference"],
} as const satisfies Record<QueryModule, readonly QueryModule[]>;

export function invalidationKeysForModule(
  organizationId: string,
  module: QueryModule
) {
  return MODULE_INVALIDATION_DEPENDENCIES[module].map((affectedModule) =>
    queryKeys.module(organizationId, affectedModule)
  );
}
