"use client";

import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SaleFilterBar({
  q,
  platform,
  land,
  platforms,
}: {
  q: string;
  platform: string;
  land: string;
  platforms: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const query = String(formData.get("q") ?? "").trim();
    const p = String(formData.get("platform") ?? "");
    const country = String(formData.get("land") ?? "");
    if (query) params.set("q", query);
    if (p) params.set("platform", p);
    if (country) params.set("land", country);
    router.push(`/verkauf${params.size ? `?${params}` : ""}`);
  }

  return (
    <form action={apply} className="flex flex-wrap items-end gap-2">
      <div className="w-64">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Suche: Order-ID, Artikel, Käufer…"
        />
      </div>
      <select
        name="platform"
        defaultValue={platform}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Alle Plattformen</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        name="land"
        defaultValue={land}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Alle Länder</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      {(q || platform || land) && (
        <Button type="button" variant="ghost" onClick={() => router.push("/verkauf")}>
          Zurücksetzen
        </Button>
      )}
    </form>
  );
}
