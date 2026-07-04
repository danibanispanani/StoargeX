import type { Role } from "@prisma/client";

export const ROLE_WEIGHT: Record<Role, number> = {
  READONLY: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Inhaber",
  ADMIN: "Administrator",
  MEMBER: "Mitglied",
  READONLY: "Nur Lesen",
};

export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minRole];
}

/** OWNER und ADMIN müssen 2FA aktiviert haben. */
export function requiresTwoFactor(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}
