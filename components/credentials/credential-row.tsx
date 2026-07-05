"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteCredentialAction,
  revealCredentialAction,
} from "@/lib/actions/credentials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

const HIDE_AFTER_MS = 30_000;

export function CredentialRow({
  credential,
}: {
  credential: {
    id: string;
    label: string;
    username: string | null;
    platformName: string | null;
    lastRotatedAt: string;
  };
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Angezeigtes Secret nach 30s automatisch wieder ausblenden
  useEffect(() => {
    if (secret) {
      hideTimer.current = setTimeout(() => setSecret(null), HIDE_AFTER_MS);
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }
  }, [secret]);

  function reveal() {
    startTransition(async () => {
      const result = await revealCredentialAction(credential.id);
      if ("error" in result) toast.error(result.error);
      else setSecret(result.secret);
    });
  }

  function copyToClipboard() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => toast.success("Kopiert."));
  }

  function remove() {
    if (!confirm(`"${credential.label}" wirklich löschen?`)) return;
    startTransition(async () => {
      const result = await deleteCredentialAction(credential.id);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{credential.label}</TableCell>
      <TableCell>{credential.username ?? "–"}</TableCell>
      <TableCell>
        {credential.platformName ? (
          <Badge variant="outline">{credential.platformName}</Badge>
        ) : (
          "–"
        )}
      </TableCell>
      <TableCell>
        {secret ? (
          <span className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {secret}
            </code>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={copyToClipboard}>
              Kopieren
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSecret(null)}
            >
              Verbergen
            </Button>
          </span>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={reveal}>
            {pending ? "…" : "Anzeigen"}
          </Button>
        )}
      </TableCell>
      <TableCell>{credential.lastRotatedAt}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={remove}
        >
          Löschen
        </Button>
      </TableCell>
    </TableRow>
  );
}
