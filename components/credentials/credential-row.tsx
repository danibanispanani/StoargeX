"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CopyIcon, EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCredentialAction,
  revealCredentialAction,
} from "@/lib/actions/credentials";
import { Badge } from "@/components/ui/badge";
import { ActionIconButton } from "@/components/ui/action-icon-button";
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
    <TableRow
      data-table-view-row
      data-row-view-standard
      data-row-view-platform={Boolean(credential.platformName) || undefined}
      data-row-view-rotation
      data-row-view-all
    >
      <TableCell data-column data-column-key="label" data-view-standard data-view-platform data-view-rotation data-view-all className="font-medium">{credential.label}</TableCell>
      <TableCell data-column data-column-key="username" data-view-standard data-view-platform data-view-all>{credential.username ?? "–"}</TableCell>
      <TableCell data-column data-column-key="platform" data-view-standard data-view-platform data-view-all>
        {credential.platformName ? (
          <Badge variant="outline">{credential.platformName}</Badge>
        ) : (
          "–"
        )}
      </TableCell>
      <TableCell data-column data-column-key="secret" data-view-standard data-view-all>
        {secret ? (
          <span className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {secret}
            </code>
            <ActionIconButton label="Zugangsdaten kopieren" icon={CopyIcon} onClick={copyToClipboard} />
            <ActionIconButton
              label="Zugangsdaten verbergen"
              icon={EyeOffIcon}
              onClick={() => setSecret(null)}
            />
          </span>
        ) : (
          <ActionIconButton
            label={pending ? "Zugangsdaten werden geladen" : "Zugangsdaten anzeigen"}
            icon={EyeIcon}
            variant="outline"
            disabled={pending}
            onClick={reveal}
          />
        )}
      </TableCell>
      <TableCell data-column data-column-key="rotated" data-view-standard data-view-rotation data-view-all>{credential.lastRotatedAt}</TableCell>
      <TableCell data-column data-column-key="actions" data-view-standard data-view-platform data-view-rotation data-view-all>
        <ActionIconButton
          label="Zugangsdaten löschen"
          icon={Trash2Icon}
          className="text-destructive"
          disabled={pending}
          onClick={remove}
        />
      </TableCell>
    </TableRow>
  );
}
