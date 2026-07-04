import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { formatEuro } from "@/lib/calculations";
import { CreateDebtDialog } from "@/components/debts/create-debt-dialog";
import { DebtRowActions } from "@/components/debts/debt-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DebtsPage() {
  const { db, membership } = await requireOrg();
  const canDelete = hasMinRole(membership.role, "ADMIN");

  const [debts, members] = await Promise.all([
    db.debt.findMany({
      orderBy: [{ status: "asc" }, { debtDate: "desc" }],
      take: 300,
    }),
    db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const openCents = debts
    .filter((d) => d.status !== "SETTLED")
    .reduce((sum, d) => sum + d.amountCents - d.paidCents, 0);

  const memberNames = members.map((m) => m.user.name ?? m.user.email);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schulden</h1>
          <p className="text-sm text-muted-foreground">
            Forderungen und Verbindlichkeiten zwischen den Gesellschaftern
            {debts.length > 0 && <> · offen: {formatEuro(openCents)}</>}
          </p>
        </div>
        <CreateDebtDialog memberNames={memberNames} />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Schuldner</TableHead>
                <TableHead>Gläubiger</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Keine Einträge – niemand schuldet niemandem etwas. Neue
                    Forderung über „Eintrag anlegen&ldquo; erfassen.
                  </TableCell>
                </TableRow>
              )}
              {debts.map((debt) => (
                <TableRow key={debt.id} className={debt.status === "SETTLED" ? "opacity-60" : ""}>
                  <TableCell>{debt.debtDate.toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="max-w-64 truncate">{debt.description ?? "–"}</TableCell>
                  <TableCell>{debt.debtorName}</TableCell>
                  <TableCell>{debt.creditorName}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuro(debt.amountCents)}
                  </TableCell>
                  <TableCell>
                    {debt.status === "SETTLED" ? (
                      <Badge variant="secondary">
                        Beglichen
                        {debt.settledAt && ` (${debt.settledAt.toLocaleDateString("de-DE")})`}
                      </Badge>
                    ) : (
                      <Badge>Offen</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DebtRowActions
                      debtId={debt.id}
                      settled={debt.status === "SETTLED"}
                      canDelete={canDelete}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
