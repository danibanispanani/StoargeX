import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { formatEuro } from "@/lib/calculations";
import { DEBT_TYPE_LABELS } from "@/lib/constants";
import { DebtDialog, type EditableDebt } from "@/components/debts/debt-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import {
  DebtEntrySelect,
  DebtStatusSelect,
  DeleteDebtButton,
} from "@/components/debts/debt-inline-selects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DebtWithReference = Prisma.DebtGetPayload<{
  include: {
    purchaseLink: {
      include: { purchase: { select: { id: true; purchaseNumber: true } } };
    };
    saleLink: {
      include: { sale: { select: { id: true; orderNumber: true } } };
    };
    inventoryLinks: {
      include: {
        inventoryPosition: { select: { id: true; inventoryNumber: true } };
      };
    };
  };
}>;

export default async function DebtsPage() {
  const { db, membership } = await requireOrg();
  const canDelete = hasMinRole(membership.role, "ADMIN");

  const [debts, members] = await Promise.all([
    db.debt.findMany({
      include: {
        purchaseLink: {
          include: { purchase: { select: { id: true, purchaseNumber: true } } },
        },
        saleLink: {
          include: { sale: { select: { id: true, orderNumber: true } } },
        },
        inventoryLinks: {
          include: {
            inventoryPosition: { select: { id: true, inventoryNumber: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { debtDate: "desc" }],
      take: 500,
    }),
    db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const openCents = debts
    .filter((debt) => debt.status === "OPEN" || debt.status === "PARTIALLY_PAID")
    .reduce((sum, debt) => sum + debt.amountCents - debt.paidCents, 0);

  const memberNames = members.map((member) => member.user.name ?? member.user.email);

  function toEditable(debt: DebtWithReference): EditableDebt {
    return {
      id: debt.id,
      debtDate: debt.debtDate.toISOString().slice(0, 10),
      refId: debt.refId ?? "",
      description: debt.description ?? "",
      kind: debt.kind,
      quantity: debt.quantity,
      amount: (debt.amountCents / 100).toFixed(2).replace(".", ","),
      debtorName: debt.debtorName,
      creditorName: debt.creditorName,
      status: debt.status === "PARTIALLY_PAID" ? "OPEN" : debt.status,
      entryStatus: debt.entryStatus,
      settledAt: debt.settledAt?.toISOString().slice(0, 10) ?? "",
      notes: debt.notes ?? "",
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Schulden</h1>
          <p className="text-sm text-muted-foreground">
            Kauf-/Verkaufs-Einträge entstehen automatisch · offen:{" "}
            {formatEuro(openCents)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="schulden" />
          <DebtDialog memberNames={memberNames} />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Schuld</TableHead>
                <TableHead>Bezug</TableHead>
                <TableHead>Artikelbeschreibung</TableHead>
                <TableHead>Art</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Schuldner</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eintrag</TableHead>
                <TableHead>Beglichen am</TableHead>
                <TableHead>Kommentar</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="py-8 text-center text-muted-foreground">
                    Keine Einträge – niemand schuldet niemandem etwas.
                    Einträge entstehen automatisch (ZM bzw. Auszahlung an
                    Personen) oder über „Schuld manuell eintragen“.
                  </TableCell>
                </TableRow>
              )}
              {debts.map((debt) => (
                <TableRow
                  key={debt.id}
                  className={debt.status === "SETTLED" ? "opacity-60" : ""}
                >
                  <TableCell className="whitespace-nowrap">
                    {debt.debtDate.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {debt.debtNumber ?? "–"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    <DebtReference debt={debt} />
                  </TableCell>
                  <TableCell className="max-w-52 truncate">
                    {debt.description ?? "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{DEBT_TYPE_LABELS[debt.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{debt.quantity}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatEuro(debt.amountCents)}
                  </TableCell>
                  <TableCell>{debt.debtorName}</TableCell>
                  <TableCell>{debt.creditorName}</TableCell>
                  <TableCell>
                    <DebtStatusSelect debtId={debt.id} status={debt.status} />
                  </TableCell>
                  <TableCell>
                    <DebtEntrySelect debtId={debt.id} entryStatus={debt.entryStatus} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {debt.settledAt?.toLocaleDateString("de-DE") ?? "–"}
                  </TableCell>
                  <TableCell className="max-w-36 truncate">
                    {debt.notes ?? "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <DebtDialog
                        debt={toEditable(debt)}
                        memberNames={memberNames}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Bearbeiten
                          </Button>
                        }
                      />
                      {canDelete && <DeleteDebtButton debtId={debt.id} />}
                    </div>
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

function DebtReference({ debt }: { debt: DebtWithReference }) {
  if (debt.saleLink?.sale) {
    return (
      <Link
        href={`/verkauf?sale=${debt.saleLink.sale.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
      >
        {debt.saleLink.sale.orderNumber ?? "Verkauf"}
      </Link>
    );
  }

  if (debt.purchaseLink?.purchase) {
    return (
      <Link
        href={`/lager?purchase=${debt.purchaseLink.purchase.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
      >
        {debt.purchaseLink.purchase.purchaseNumber}
      </Link>
    );
  }

  const inventory = debt.inventoryLinks[0]?.inventoryPosition;
  if (inventory) {
    return (
      <Link
        href={`/lager?inventory=${inventory.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
      >
        {inventory.inventoryNumber}
      </Link>
    );
  }

  if (debt.type === "MANUAL") return <span>Manuell</span>;
  return <span className="font-mono text-xs">{debt.refId ?? "Legacy"}</span>;
}
