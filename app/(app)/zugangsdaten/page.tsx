import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { CreateCredentialDialog } from "@/components/credentials/create-credential-dialog";
import { CredentialRow } from "@/components/credentials/credential-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { OperationalSearchToolbar } from "@/components/table/operational-search-toolbar";

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const { db, membership, organization, userId } = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(OPERATIONAL_MODULES.credentials, preset);
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
      where: q
        ? {
            OR: [
              { label: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { platform: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: { platform: { select: { name: true } } },
      orderBy: { label: "asc" },
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const visibleCredentialCount = requestedView === "platform"
    ? credentials.filter((credential) => Boolean(credential.platform)).length
    : credentials.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verwaltung · Sicherheit"
        title="Zugangsdaten-Tresor"
        description="AES-256 Envelope Encryption · Entschlüsselung nur serverseitig · jeder Abruf wird protokolliert."
        actions={<CreateCredentialDialog platforms={platforms} />}
      />
      <OperationalSearchToolbar
        basePath="/zugangsdaten"
        query={q ?? ""}
        placeholder="Label, Benutzername oder Plattform"
        hiddenParams={{ preset: requestedView === "standard" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.credentials}
        scope={{ organizationId: organization.id, userId }}
        requestedView={requestedView}
        currentQuery={operationalSearchParams({
          preset: requestedView === "standard" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleCredentialCount}
      >
      <Card className="rounded-none border-0 shadow-none">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead data-column data-column-key="label" data-view-standard data-view-platform data-view-rotation data-view-all>Label</TableHead>
                <TableHead data-column data-column-key="username" data-view-standard data-view-platform data-view-all>Benutzername</TableHead>
                <TableHead data-column data-column-key="platform" data-view-standard data-view-platform data-view-all>Plattform</TableHead>
                <TableHead data-column data-column-key="secret" data-view-standard data-view-all>Secret</TableHead>
                <TableHead data-column data-column-key="rotated" data-view-standard data-view-rotation data-view-all>Zuletzt geändert</TableHead>
                <TableHead data-column data-column-key="actions" data-view-standard data-view-platform data-view-rotation data-view-all className="w-24">Aktionen</TableHead>
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
      </CompactTableShell>
    </div>
  );
}
