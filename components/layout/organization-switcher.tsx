"use client";

import { useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionMembership } from "@/types/next-auth";
import { switchOrganizationAction } from "@/lib/actions/session";
import { resetOrganizationCache } from "@/lib/query/query-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrganizationSwitcher({
  memberships,
  activeOrganizationId,
}: {
  memberships: readonly SessionMembership[];
  activeOrganizationId: string;
}) {
  const active = memberships.find((membership) => membership.orgId === activeOrganizationId);
  const queryClient = useQueryClient();
  const switchInFlight = useRef(false);
  const [isSwitching, setIsSwitching] = useState(false);
  if (!active) return null;

  async function switchOrganization(formData: FormData) {
    if (switchInFlight.current) return;
    switchInFlight.current = true;
    setIsSwitching(true);

    try {
      const result = await switchOrganizationAction(formData);
      resetOrganizationCache(
        queryClient,
        activeOrganizationId,
        result.organizationId
      );
      window.location.assign("/dashboard");
    } catch (error) {
      switchInFlight.current = false;
      setIsSwitching(false);
      throw error;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-[13rem] justify-start px-2">
          <Building2 className="size-4 shrink-0 text-transit-teal" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{active.orgName}</span>
          {memberships.length > 1 ? <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Organisation
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((membership) => (
          <form action={switchOrganization} key={membership.orgId}>
            <input type="hidden" name="organizationId" value={membership.orgId} />
            <DropdownMenuItem
              asChild
              disabled={isSwitching || membership.orgId === activeOrganizationId}
            >
              <button type="submit" className="w-full">
                <span className="min-w-0 flex-1 truncate text-left">{membership.orgName}</span>
                {membership.orgId === activeOrganizationId ? <Check className="size-4 text-transit-teal" aria-hidden="true" /> : null}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
