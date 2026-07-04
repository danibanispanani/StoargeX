"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  confirmTotpSetupAction,
  disableTotpAction,
  startTotpSetupAction,
  type TotpConfirmState,
} from "@/lib/actions/two-factor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TwoFactorSetup({
  enabled,
  mandatory,
}: {
  enabled: boolean;
  mandatory: boolean;
}) {
  const router = useRouter();
  const [starting, startTransition] = useTransition();
  const [setup, setSetup] = useState<{
    qrDataUrl: string;
    secret: string;
  } | null>(null);

  const [confirmState, confirmAction, confirming] = useActionState<
    TotpConfirmState,
    FormData
  >(confirmTotpSetupAction, null);
  const [disableState, disableAction, disabling] = useActionState<
    TotpConfirmState,
    FormData
  >(disableTotpAction, null);

  const recoveryCodes =
    confirmState && "recoveryCodes" in confirmState
      ? confirmState.recoveryCodes
      : null;

  // Nach erfolgreicher Aktivierung: Recovery-Codes anzeigen
  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            2FA ist jetzt aktiv. Bewahre diese Wiederherstellungscodes sicher
            auf – sie werden nur einmal angezeigt und ersetzen jeweils einmalig
            einen 2FA-Code.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-2 gap-2 rounded-md border p-4 font-mono text-sm sm:grid-cols-5">
          {recoveryCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <Button onClick={() => router.push("/dashboard")}>
          Codes gespeichert – weiter
        </Button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          2FA ist für dein Konto aktiv.
        </p>
        {mandatory ? (
          <p className="text-sm text-muted-foreground">
            Für Inhaber und Administratoren kann 2FA nicht deaktiviert werden.
          </p>
        ) : (
          <form action={disableAction} className="flex max-w-sm items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="disable-code">Aktueller 2FA-Code</Label>
              <Input
                id="disable-code"
                name="code"
                inputMode="numeric"
                placeholder="123456"
                required
              />
            </div>
            <Button type="submit" variant="destructive" disabled={disabling}>
              Deaktivieren
            </Button>
          </form>
        )}
        {disableState && "error" in disableState && disableState.error && (
          <Alert variant="destructive">
            <AlertDescription>{disableState.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  if (!setup) {
    return (
      <Button
        disabled={starting}
        onClick={() =>
          startTransition(async () => {
            const result = await startTotpSetupAction();
            if ("error" in result) return;
            setSetup({ qrDataUrl: result.qrDataUrl, secret: result.secret });
          })
        }
      >
        {starting ? "Wird vorbereitet…" : "2FA einrichten"}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Scanne den QR-Code mit deiner Authenticator-App.</li>
        <li>Gib den angezeigten 6-stelligen Code ein.</li>
      </ol>
      <Image
        src={setup.qrDataUrl}
        alt="TOTP QR-Code"
        width={240}
        height={240}
        unoptimized
        className="rounded-md border"
      />
      <p className="text-xs text-muted-foreground">
        Manuelle Eingabe: <code className="font-mono">{setup.secret}</code>
      </p>
      <form action={confirmAction} className="flex max-w-sm items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="confirm-code">Code aus der App</Label>
          <Input
            id="confirm-code"
            name="code"
            inputMode="numeric"
            placeholder="123456"
            required
            autoFocus
          />
        </div>
        <Button type="submit" disabled={confirming}>
          Aktivieren
        </Button>
      </form>
      {confirmState && "error" in confirmState && confirmState.error && (
        <Alert variant="destructive">
          <AlertDescription>{confirmState.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
