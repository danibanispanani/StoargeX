"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Geschützte App-Route fehlgeschlagen.", error);
  }, [error]);

  return (
    <ErrorState
      title="Bereich konnte nicht geladen werden"
      description="Die Anfrage ist fehlgeschlagen. Versuche es erneut; gespeicherte Daten wurden nicht verändert."
      action={
        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Erneut versuchen
        </Button>
      }
    />
  );
}
