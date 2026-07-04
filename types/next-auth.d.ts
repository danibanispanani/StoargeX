import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

export interface SessionMembership {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      totpEnabled: boolean;
    } & DefaultSession["user"];
    memberships: SessionMembership[];
    activeOrgId: string | null;
    activeRole: Role | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    memberships: SessionMembership[];
    activeOrgId: string | null;
    totpEnabled: boolean;
  }
}
