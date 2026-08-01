import Link from "next/link";
import { PencilIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { formatEuro } from "@/lib/calculations";
import { DEBT_TYPE_LABELS } from "@/lib/constants";
import { DebtDialog, type EditableDebt } from "@/components/debts/debt-dialog";
import {
  DebtEntrySelect,
  DebtStatusSelect,
  DeleteDebtButton,
} from "@/components/debts/debt-inline-selects";
import { Badge } from "@/components/ui/badge";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import { PageHeader } from "@/components/app/page-header";
import {
  DetailDrawer,
  DetailGrid,
  DetailSection,
} from "@/components/table/detail-drawer";
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

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const { db, membership, organization, userId } = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(OPERATIONAL_MODULES.debts, preset);
  const canDelete = hasMinRole(membership.role, "ADMIN");

  const [debts, members] = await Promise.all([
    db.debt.findMany({
      where: q
        ? {
            OR: [
              { debtNumber: { contains: q, mode: "insensitive" } },
              { refId: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { debtorName: { contains: q, mode: "insensitive" } },
              { creditorName: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
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

  const memberNames = members.map((member) => member.user.name ?? member.user.email);
  const visibleDebtCount = debts.filter((debt) => {
    if (requestedView === "due") return debt.status !== "SETTLED" && Boolean(debt.dueDate);
    if (requestedView === "settled") return debt.status === "SETTLED";
    return true;
  }).length;

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
      <PageHeader
        eyebrow="Finanzen"
        title="Schulden"
        description="Offene Verpflichtungen, Fälligkeiten und Zahlungen nachvollziehen."
        actions={<DebtDialog memberNames={memberNames} />}
      />
      <OperationalSearchToolbar
        basePath="/schulden"
        query={q ?? ""}
        placeholder="SCH-Nummer, Bezug, Beschreibung oder Partei"
        hiddenParams={{ preset: requestedView === "standard" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.debts}
        scope={{ organizationId: organization.id, userId }}
        currentQuery={operationalSearchParams({
          preset: requestedView === "standard" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleDebtCount}
      >
      <Card className="rounded-none border-0 shadow-none">
        <CardContent className="overflow-x-auto">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead data-column data-column-key="date" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>Datum</TableHead>
                <TableHead data-column data-column-key="number" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>SCH-Nummer</TableHead>
                <TableHead data-column data-column-key="reference" data-view-standard data-view-due data-view-settled data-view-all>Bezug</TableHead>
                <TableHead data-column data-column-key="description" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>Beschreibung</TableHead>
                <TableHead data-column data-column-key="due" data-view-standard data-view-due data-view-all>Fällig am</TableHead>
                <TableHead data-column data-column-key="type" data-view-accounting data-view-all>Art</TableHead>
                <TableHead data-column data-column-key="quantity" data-view-accounting data-view-all className="text-right">Menge</TableHead>
                <TableHead data-column data-column-key="amount" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="text-right">Betrag</TableHead>
                <TableHead data-column data-column-key="debtor" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>Schuldner</TableHead>
                <TableHead data-column data-column-key="creditor" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>Empfänger</TableHead>
                <TableHead data-column data-column-key="status" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>Status</TableHead>
                <TableHead data-column data-column-key="entry" data-view-accounting data-view-all>Eintrag</TableHead>
                <TableHead data-column data-column-key="settledAt" data-view-accounting data-view-settled data-view-all>Beglichen am</TableHead>
                <TableHead data-column data-column-key="notes" data-view-accounting data-view-all>Kommentar</TableHead>
                <TableHead data-column data-column-key="actions" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="w-48">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} className="py-8 text-center text-muted-foreground">
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
                  data-table-view-row
                  data-row-view-standard
                  data-row-view-accounting
                  data-row-view-due={(debt.status !== "SETTLED" && Boolean(debt.dueDate)) || undefined}
                  data-row-view-settled={debt.status === "SETTLED" || undefined}
                  data-row-view-all
                >
                  <TableCell data-column data-column-key="date" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="whitespace-nowrap">
                    {debt.debtDate.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell data-column data-column-key="number" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="max-w-32 truncate font-mono text-xs">
                    {debt.debtNumber ?? "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="reference" data-view-standard data-view-due data-view-settled data-view-all className="max-w-40 truncate">
                    <DebtReference debt={debt} />
                  </TableCell>
                  <TableCell data-column data-column-key="description" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="sx-cell-primary max-w-52 truncate">
                    {debt.description ?? "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="due" data-view-standard data-view-due data-view-all className="whitespace-nowrap">
                    {debt.dueDate?.toLocaleDateString("de-DE") ?? "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="type" data-view-accounting data-view-all>
                    <Badge variant="outline">{DEBT_TYPE_LABELS[debt.type]}</Badge>
                  </TableCell>
                  <TableCell data-column data-column-key="quantity" data-view-accounting data-view-all className="text-right">{debt.quantity}</TableCell>
                  <TableCell data-column data-column-key="amount" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all className="sx-cell-money text-right font-mono font-medium">
                    {formatEuro(debt.amountCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="debtor" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>{debt.debtorName}</TableCell>
                  <TableCell data-column data-column-key="creditor" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>{debt.creditorName}</TableCell>
                  <TableCell data-column data-column-key="status" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>
                    <DebtStatusSelect debtId={debt.id} status={debt.status} />
                  </TableCell>
                  <TableCell data-column data-column-key="entry" data-view-accounting data-view-all>
                    <DebtEntrySelect debtId={debt.id} entryStatus={debt.entryStatus} />
                  </TableCell>
                  <TableCell data-column data-column-key="settledAt" data-view-accounting data-view-settled data-view-all className="whitespace-nowrap">
                    {debt.settledAt?.toLocaleDateString("de-DE") ?? "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="notes" data-view-accounting data-view-all className="max-w-36 truncate">
                    {debt.notes ?? "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="actions" data-view-standard data-view-accounting data-view-due data-view-settled data-view-all>
                    <div className="flex gap-1">
                      <DebtDetailDrawer debt={debt} />
                      <DebtDialog
                        debt={toEditable(debt)}
                        memberNames={memberNames}
                        trigger={
                          <ActionIconButton label="Schulden-Eintrag bearbeiten" icon={PencilIcon} />
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
      </CompactTableShell>
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

function DebtDetailDrawer({ debt }: { debt: DebtWithReference }) {
  return (
    <DetailDrawer
      title={debt.debtNumber ?? debt.id.slice(0, 8)}
      description={debt.description ?? "Schuld"}
    >
      <DetailSection title="Bezug">
        <div className="text-foreground">
          <DebtReference debt={debt} />
        </div>
      </DetailSection>
      <DetailSection title="Schuld">
        <DetailGrid
          items={[
            { label: "Datum", value: debt.debtDate.toLocaleDateString("de-DE") },
            { label: "Art", value: DEBT_TYPE_LABELS[debt.type] },
            { label: "Menge", value: debt.quantity },
            { label: "Betrag", value: formatEuro(debt.amountCents) },
            { label: "Bezahlt", value: formatEuro(debt.paidCents) },
            { label: "Offen", value: formatEuro(debt.amountCents - debt.paidCents) },
          ]}
        />
      </DetailSection>
      <DetailSection title="Parteien und Status">
        <DetailGrid
          items={[
            { label: "Schuldner", value: debt.debtorName },
            { label: "Empfänger", value: debt.creditorName },
            { label: "Status", value: debt.status },
            { label: "Eintrag", value: debt.entryStatus },
            { label: "Beglichen am", value: debt.settledAt?.toLocaleDateString("de-DE") ?? "–" },
          ]}
        />
      </DetailSection>
      {debt.notes && (
        <DetailSection title="Kommentar">
          <p>{debt.notes}</p>
        </DetailSection>
      )}
    </DetailDrawer>
  );
}
