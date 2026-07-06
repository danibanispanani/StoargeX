"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const OPTIONS = [
  { value: "dieses-jahr", label: "Dieses Jahr" },
  { value: "letztes-jahr", label: "Letztes Jahr" },
  { value: "benutzerdefiniert", label: "Benutzerdefiniert" },
];

/** Zeitraum-Filter, der alle Dashboard-Widgets gleichzeitig filtert. */
export function DashboardFilter({
  jahr,
  von,
  bis,
}: {
  jahr: string;
  von: string;
  bis: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/dashboard${params.size ? `?${params}` : ""}`);
  }

  const active = jahr || "dieses-jahr";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border p-0.5">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={active === option.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() =>
              navigate({
                jahr: option.value === "dieses-jahr" ? "" : option.value,
                ...(option.value !== "benutzerdefiniert" ? { von: "", bis: "" } : {}),
              })
            }
          >
            {option.label}
          </Button>
        ))}
      </div>
      {active === "benutzerdefiniert" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={von}
            aria-label="Von"
            onChange={(e) => navigate({ jahr: "benutzerdefiniert", von: e.target.value })}
            className="w-36"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={bis}
            aria-label="Bis"
            onChange={(e) => navigate({ jahr: "benutzerdefiniert", bis: e.target.value })}
            className="w-36"
          />
        </div>
      )}
    </div>
  );
}
