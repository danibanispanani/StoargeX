export const QUERY_MODULES = [
  "lager",
  "einkauf",
  "verkauf",
  "produkte",
  "dashboard",
  "reference",
] as const;

export type QueryModule = (typeof QUERY_MODULES)[number];
export type QueryParameterScalar = string | number | boolean;
export type QueryParameterValue =
  | QueryParameterScalar
  | readonly QueryParameterScalar[]
  | null
  | undefined;
export type QueryParameterInput =
  | URLSearchParams
  | Readonly<Record<string, QueryParameterValue>>;
export type NormalizedQuery = Readonly<
  Record<string, string | readonly string[]>
>;
export type QueryNormalizationOptions = {
  defaults?: Readonly<Record<string, QueryParameterValue>>;
  unorderedKeys?: readonly string[];
};

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeValues(value: QueryParameterValue): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((entry): entry is QueryParameterScalar => entry != null && entry !== "")
    .map(String);
}

function collectQueryEntries(input: QueryParameterInput) {
  if (input instanceof URLSearchParams) {
    const entries = new Map<string, string[]>();
    for (const [key, value] of input.entries()) {
      if (!value) continue;
      const values = entries.get(key) ?? [];
      values.push(value);
      entries.set(key, values);
    }
    return entries;
  }

  return new Map(Object.entries(input));
}

function normalizeWithoutDefaults(
  input: QueryParameterInput,
  unorderedKeys: ReadonlySet<string>
): NormalizedQuery {
  const normalized: Record<string, string | readonly string[]> = {};
  const entries = [...collectQueryEntries(input).entries()].sort(([left], [right]) =>
    compareText(left, right)
  );

  for (const [key, rawValues] of entries) {
    const values = normalizeValues(rawValues);
    if (unorderedKeys.has(key)) values.sort(compareText);
    if (values.length === 1) normalized[key] = values[0];
    if (values.length > 1) normalized[key] = values;
  }

  return normalized;
}

export function normalizeQueryParameters(
  input: QueryParameterInput,
  options: QueryNormalizationOptions = {}
): NormalizedQuery {
  const unorderedKeys = new Set(options.unorderedKeys);
  const normalized = normalizeWithoutDefaults(input, unorderedKeys);
  const normalizedDefaults = normalizeWithoutDefaults(
    options.defaults ?? {},
    unorderedKeys
  );

  return Object.fromEntries(
    Object.entries(normalized).filter(([key, value]) => {
      const defaultValue = normalizedDefaults[key];
      return JSON.stringify(value) !== JSON.stringify(defaultValue);
    })
  );
}

export const queryKeys = {
  organization: (organizationId: string) => ["org", organizationId] as const,
  module: (organizationId: string, module: QueryModule) =>
    [...queryKeys.organization(organizationId), module] as const,
  resource: (
    organizationId: string,
    module: QueryModule,
    resource: string,
    query?: QueryParameterInput,
    normalization?: QueryNormalizationOptions
  ) => {
    const key = [...queryKeys.module(organizationId, module), resource] as const;
    return query === undefined
      ? key
      : ([...key, normalizeQueryParameters(query, normalization)] as const);
  },
};

export function isReferenceQueryKey(queryKey: readonly unknown[]) {
  return queryKey[0] === "org" && queryKey[2] === "reference";
}
