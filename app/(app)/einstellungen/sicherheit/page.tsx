import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requiresTwoFactor } from "@/lib/roles";
import { TwoFactorSetup } from "@/components/settings/two-factor-setup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ pflicht?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { pflicht } = await searchParams;
  const mandatory = session.memberships.some((m) => requiresTwoFactor(m.role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sicherheit</h1>
        <p className="text-sm text-muted-foreground">
          Zwei-Faktor-Authentifizierung (TOTP)
        </p>
      </div>

      {pflicht && !session.user.totpEnabled && (
        <Alert>
          <AlertDescription>
            Als Inhaber oder Administrator musst du die
            Zwei-Faktor-Authentifizierung aktivieren, bevor du fortfahren
            kannst.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Authenticator-App
            {session.user.totpEnabled ? (
              <Badge>Aktiv</Badge>
            ) : (
              <Badge variant="outline">Nicht eingerichtet</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Kompatibel mit Google Authenticator, Aegis, 1Password u.&nbsp;a.
            {mandatory && " Für deine Rolle ist 2FA verpflichtend."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup
            enabled={session.user.totpEnabled}
            mandatory={mandatory}
          />
        </CardContent>
      </Card>
    </div>
  );
}
