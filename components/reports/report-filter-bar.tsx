"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { value: "7", label: "7 Tage" },
  { value: "30", label: "30 Tage" },
  { value: "90", label: "90 Tage" },
  { value: "365", label: "12 Monate" },
  { value: "alle", label: "Gesamt" },
];

/** Zeitraum- und Plattformfilter für Dashboard & Berichte (Query-Parameter). */
export function ReportFilterBar({
  basePath,
  zeitraum,
  platformId,
  platforms,
}: {
  basePath: string;
  zeitraum: string;
  platformId: string;
  platforms: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  function navigate(nextZeitraum: string, nextPlatform: string) {
    const params = new URLSearchParams();
    if (nextZeitraum !== "30") params.set("zeitraum", nextZeitraum);
    if (nextPlatform) params.set("plattform", nextPlatform);
    router.push(`${basePath}${params.size ? `?${params}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border p-0.5">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant={zeitraum === p.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate(p.value, platformId)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <select
        value={platformId}
        onChange={(e) => navigate(zeitraum, e.target.value)}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Alle Plattformen</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
