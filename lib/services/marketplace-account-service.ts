export interface MarketplaceAccountCandidate {
  id: string;
  organizationId: string;
  platformId: string;
  displayName: string;
  active: boolean;
  defaultPayoutAccountId?: string | null;
  defaultFeeScheduleId?: string | null;
}

export type MarketplaceAccountResolutionErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "AMBIGUOUS_ACCOUNT";

export class MarketplaceAccountResolutionError extends Error {
  constructor(
    public readonly code: MarketplaceAccountResolutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MarketplaceAccountResolutionError";
  }
}

export function resolveMarketplaceAccount<T extends MarketplaceAccountCandidate>(input: {
  organizationId: string;
  platformId: string;
  requestedAccountId?: string | null;
  accounts: readonly T[];
}): T | null {
  const tenantPlatformAccounts = input.accounts.filter(
    (account) =>
      account.organizationId === input.organizationId &&
      account.platformId === input.platformId
  );

  if (input.requestedAccountId) {
    const requested = tenantPlatformAccounts.find(
      (account) => account.id === input.requestedAccountId
    );
    if (!requested) {
      throw new MarketplaceAccountResolutionError(
        "ACCOUNT_NOT_FOUND",
        "Das Plattformkonto gehört nicht zu Organisation und Plattform."
      );
    }
    if (!requested.active) {
      throw new MarketplaceAccountResolutionError(
        "ACCOUNT_INACTIVE",
        "Das ausgewählte Plattformkonto ist inaktiv."
      );
    }
    return requested;
  }

  const activeAccounts = tenantPlatformAccounts.filter((account) => account.active);
  if (activeAccounts.length === 0) return null;
  if (activeAccounts.length === 1) return activeAccounts[0];

  throw new MarketplaceAccountResolutionError(
    "AMBIGUOUS_ACCOUNT",
    "Für die Plattform existieren mehrere aktive Konten; eine explizite Auswahl ist erforderlich."
  );
}
