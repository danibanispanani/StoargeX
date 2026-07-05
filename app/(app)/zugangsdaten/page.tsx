import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { CreateCredentialDialog } from "@/components/credentials/create-credential-dialog";
import { CredentialRow } from "@/components/credentials/credential-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CredentialsPage() {
  const { db, membership } = await requireOrg();
  const canAccess = hasMinRole(membership.role, "ADMIN");

  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zugangsdaten-Tresor</CardTitle>
          <CardDescription>
            Der Zugriff auf den Tresor ist auf Inhaber und Administratoren
            beschränkt. Bitte wende dich an eine berechtigte Person.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [credentials, platforms] = await Promise.all([
    db.credential.findMany({
      include: { platform: { select: { name: true } } },
      orderBy: { label: "asc" },
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zugangsdaten-Tresor</h1>
          <p className="text-sm text-muted-foreground">
            AES-256 Envelope Encryption · Entschlüsselung nur server-seitig ·
            jeder Abruf wird protokolliert
          </p>
        </div>
        <CreateCredentialDialog platforms={platforms} />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Benutzername</TableHead>
                <TableHead>Plattform</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Zuletzt geändert</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Der Tresor ist leer. Lege über „Zugangsdaten speichern&ldquo;
                    den ersten Eintrag an – das Secret wird verschlüsselt
                    gespeichert und nie im Klartext abgelegt.
                  </TableCell>
                </TableRow>
              )}
              {credentials.map((credential) => (
                <CredentialRow
                  key={credential.id}
                  credential={{
                    id: credential.id,
                    label: credential.label,
                    username: credential.username,
                    platformName: credential.platform?.name ?? null,
                    lastRotatedAt:
                      credential.lastRotatedAt?.toLocaleDateString("de-DE") ?? "–",
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
