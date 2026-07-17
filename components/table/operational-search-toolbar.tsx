import Link from "next/link";
import { PageToolbar } from "@/components/app/page-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { operationalSearchParams } from "@/lib/operational-modules";

export function OperationalSearchToolbar({
  basePath,
  query,
  placeholder,
  hiddenParams = {},
  secondary,
}: {
  basePath: string;
  query: string;
  placeholder: string;
  hiddenParams?: Record<string, string | undefined>;
  secondary?: React.ReactNode;
}) {
  const resetQuery = operationalSearchParams(hiddenParams);

  return (
    <PageToolbar
      primary={
        <form action={basePath} method="get" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {Object.entries(hiddenParams).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null
          )}
          <Input
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            className="min-w-52 flex-1 sm:max-w-sm"
          />
          <Button type="submit" variant="secondary" size="sm">
            Suchen
          </Button>
          {query ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`${basePath}${resetQuery ? `?${resetQuery}` : ""}`}>
                Suche löschen
              </Link>
            </Button>
          ) : null}
        </form>
      }
      secondary={secondary}
    />
  );
}
