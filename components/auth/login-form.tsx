"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [error, setError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      totpCode: (form.get("totpCode") as string) || undefined,
      redirect: false,
    });
    setPending(false);

    if (!result?.error) {
      router.push(callbackUrl);
      router.refresh();
      return;
    }
    if (result.code === "2fa_required") {
      setNeedsTotp(true);
      setError("Bitte gib den Code aus deiner Authenticator-App ein.");
    } else if (result.code === "2fa_invalid") {
      setNeedsTotp(true);
      setError("Der 2FA-Code ist ungültig.");
    } else {
      setError("E-Mail oder Passwort ist falsch.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {needsTotp && (
        <div className="space-y-2">
          <Label htmlFor="totpCode">2FA-Code (oder Wiederherstellungscode)</Label>
          <Input
            id="totpCode"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            autoFocus
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wird geprüft…" : "Anmelden"}
      </Button>
    </form>
  );
}
