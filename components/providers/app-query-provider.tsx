"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useActiveOrganization } from "@/components/providers/active-organization-provider";
import {
  getAppQueryClient,
  resetOrganizationCache,
} from "@/lib/query/query-client";

export function AppQueryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = getAppQueryClient();
  const organization = useActiveOrganization();
  const previousOrganizationId = useRef(organization.id);

  useEffect(() => {
    resetOrganizationCache(
      queryClient,
      previousOrganizationId.current,
      organization.id
    );
    previousOrganizationId.current = organization.id;
  }, [organization.id, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
