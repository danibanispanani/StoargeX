import { QueryClient } from "@tanstack/react-query";
import { shouldRetryRequest } from "@/lib/query/http-client";
import { isReferenceQueryKey, queryKeys } from "@/lib/query/query-keys";

export const OPERATIONAL_STALE_TIME_MS = 15_000;
export const REFERENCE_STALE_TIME_MS = 5 * 60_000;
export const QUERY_CACHE_TIME_MS = 10 * 60_000;

export function getQueryStaleTime(queryKey: readonly unknown[]) {
  return isReferenceQueryKey(queryKey)
    ? REFERENCE_STALE_TIME_MS
    : OPERATIONAL_STALE_TIME_MS;
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ({ queryKey }) => getQueryStaleTime(queryKey),
        gcTime: QUERY_CACHE_TIME_MS,
        retry: shouldRetryRequest,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getAppQueryClient() {
  if (typeof window === "undefined") return createAppQueryClient();
  browserQueryClient ??= createAppQueryClient();
  return browserQueryClient;
}

export function resetOrganizationCache(
  queryClient: QueryClient,
  previousOrganizationId: string,
  activeOrganizationId: string
) {
  if (previousOrganizationId === activeOrganizationId) return;
  queryClient.removeQueries({
    queryKey: queryKeys.organization(previousOrganizationId),
  });
}
