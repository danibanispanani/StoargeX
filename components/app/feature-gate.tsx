import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeatureGate({
  featureName,
  description,
  ctaHref,
}: {
  featureName: string;
  description: string;
  ctaHref?: string;
}) {
  return (
    <section className="mx-auto max-w-3xl border-y border-cargo-amber/40 bg-cargo-amber/5 px-4 py-10 text-center">
      <LockKeyhole className="mx-auto size-6 text-cargo-amber" aria-hidden="true" />
      <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cargo-amber">
        Optionales Modul
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold">{featureName}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {ctaHref ? (
        <Button asChild className="mt-5">
          <Link href={ctaHref}>Add-on ansehen</Link>
        </Button>
      ) : null}
    </section>
  );
}
