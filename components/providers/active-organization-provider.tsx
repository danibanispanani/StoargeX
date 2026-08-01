"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionMembership } from "@/types/next-auth";

export type ActiveOrganizationScope = {
  id: string;
  name: string;
  role: SessionMembership["role"];
};

const ActiveOrganizationContext = createContext<ActiveOrganizationScope | null>(
  null
);

export function ActiveOrganizationProvider({
  scope,
  children,
}: {
  scope: ActiveOrganizationScope;
  children: ReactNode;
}) {
  return (
    <ActiveOrganizationContext.Provider value={scope}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}

export function useActiveOrganization() {
  const scope = useContext(ActiveOrganizationContext);
  if (!scope) {
    throw new Error(
      "useActiveOrganization must be used inside ActiveOrganizationProvider."
    );
  }
  return scope;
}
