"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import type {
  InsightFilterOption,
} from "@/lib/dashboard/load-insight-dashboard";
import type { InsightFilters } from "@/lib/dashboard/insight-dashboard";

const PERIOD_OPTIONS = [
  { value: "7-tage", label: "7 Tage" },
  { value: "30-tage", label: "30 Tage" },
  { value: "dieses-jahr", label: "Dieses Jahr" },
  { value: "letztes-jahr", label: "Vorjahr" },
  { value: "benutzerdefiniert", label: "Eigener Zeitraum" },
];

const OWNERSHIP_OPTIONS = [
  { value: "ALL", label: "Alle Bestände" },
  { value: "OWNED", label: "Eigenbestand" },
  { value: "CONSIGNMENT", label: "Konsignation" },
];

function FilterSelect({
  label,
  value,
  name,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  name: string;
  options: InsightFilterOption[];
  allLabel?: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="grid min-w-0 basis-36 flex-1 gap-1 text-[11px] font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardFilter({
  filters,
  options,
}: {
  filters: InsightFilters;
  options: {
    platforms: InsightFilterOption[];
    marketplaceAccounts: InsightFilterOption[];
    categories: InsightFilterOption[];
    members: InsightFilterOption[];
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(name: string, value: string, additional?: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(name, value);
    else params.delete(name);
    for (const [key, nextValue] of Object.entries(additional ?? {})) {
      if (nextValue) params.set(key, nextValue);
      else params.delete(key);
    }
    router.push(`/dashboard${params.size ? `?${params.toString()}` : ""}`);
  }

  const accountOptions = options.marketplaceAccounts.filter(
    (account) => !filters.platformId || account.parentValue === filters.platformId
  );

  return (
    <div className="w-full min-w-0 space-y-2" aria-label="Dashboardfilter">
      <div className="flex w-full min-w-0 gap-1 overflow-x-auto pb-1">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              navigate("zeitraum", option.value, {
                ...(option.value !== "benutzerdefiniert" ? { von: "", bis: "" } : {}),
              })
            }
            aria-pressed={filters.zeitraum === option.value}
            className="h-8 shrink-0 border-b-2 border-transparent px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:border-transit-teal aria-pressed:text-foreground"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap items-end gap-2">
        {filters.zeitraum === "benutzerdefiniert" ? (
          <>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              <span>Von</span>
              <Input
                type="date"
                value={filters.von}
                onChange={(event) => navigate("von", event.target.value)}
                className="w-36"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              <span>Bis</span>
              <Input
                type="date"
                value={filters.bis}
                onChange={(event) => navigate("bis", event.target.value)}
                className="w-36"
              />
            </label>
          </>
        ) : null}

        <FilterSelect
          label="Plattform"
          name="platform"
          value={filters.platformId}
          options={options.platforms}
          allLabel="Alle Plattformen"
          onChange={(name, value) => navigate(name, value, { account: "" })}
        />
        <FilterSelect
          label="Plattformkonto"
          name="account"
          value={filters.marketplaceAccountId}
          options={accountOptions}
          allLabel="Alle Konten"
          onChange={navigate}
        />
        <FilterSelect
          label="Produktkategorie"
          name="category"
          value={filters.category}
          options={options.categories}
          allLabel="Alle Kategorien"
          onChange={navigate}
        />
        <FilterSelect
          label="Bestandsart"
          name="ownership"
          value={filters.ownership}
          options={OWNERSHIP_OPTIONS}
          onChange={navigate}
        />
        <FilterSelect
          label="Mitglied"
          name="member"
          value={filters.memberId}
          options={options.members}
          allLabel="Gesamtes Team"
          onChange={navigate}
        />
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        Plattform, Konto, Kategorie und Bestandsart filtern Handel und Bestand. Mitglied
        wirkt auf Team Flow. Schulden und Lieferantenfristen bleiben
        organisationsweit sichtbar.
      </p>
    </div>
  );
}
