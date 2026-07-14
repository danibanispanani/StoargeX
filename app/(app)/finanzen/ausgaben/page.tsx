import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ExpenseDialog, MaterializeExpensesButton } from "@/components/finance/expense-dialog";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db } = await requireOrg();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseExpenseStatus(params.status);
  const [expenses, categories, suppliers, paymentAccounts, marketplaceAccounts] = await Promise.all([
    db.expense.findMany({ where: { ...(status ? { status } : {}), ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }] } : {}) }, include: { category: true, supplier: true, paymentAccount: true, marketplaceAccount: true, recurrence: true }, orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }], take: 500 }),
    db.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.businessPartner.findMany({ orderBy: { displayName: "asc" }, take: 500 }),
    db.payoutAccount.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
    db.marketplaceAccount.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
  ]);
  return <div className="space-y-5"><PageHeader eyebrow="Finanzen / Betrieb" title="Ausgaben" description="Einmalige und wiederkehrende Betriebsausgaben – getrennt von produktbezogenen Deckungsbeiträgen." actions={<ExpenseDialog categories={categories.map((item) => item.name)} suppliers={suppliers.map((item) => ({ id: item.id, label: item.displayName }))} paymentAccounts={paymentAccounts.map((item) => ({ id: item.id, label: item.displayName }))} marketplaceAccounts={marketplaceAccounts.map((item) => ({ id: item.id, label: item.displayName }))} />} />
    <PageToolbar primary={<form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Ausgaben durchsuchen…" className="border-input h-8 w-64 border bg-background px-3 text-sm" /><select name="status" defaultValue={status ?? ""} className="border-input h-8 border bg-background px-2 text-sm"><option value="">Alle Status</option><option value="DRAFT">Entwurf</option><option value="POSTED">Gebucht</option><option value="CANCELLED">Storniert</option></select><button className="h-8 border px-3 text-sm">Filtern</button></form>} secondary={<><MaterializeExpensesButton /><ImportExportBar table="ausgaben" /></>} />
    <div className="overflow-x-auto border bg-card"><table className="sx-datatable min-w-[70rem] w-full"><thead><tr><th>Ausgabe</th><th>Art</th><th>Kategorie</th><th>Lieferant / Konto</th><th>Datum / Fälligkeit</th><th className="text-right">Netto</th><th className="text-right">Brutto</th><th>Status</th></tr></thead><tbody>{expenses.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Keine Ausgaben in dieser Ansicht.</td></tr> : expenses.map((expense) => <tr key={expense.id}><td><div className="font-medium">{expense.description}</div><div className="text-xs text-muted-foreground">{expense.receiptReference || expense.notes || "–"}</div></td><td>{expense.recurrence ? <Badge variant="outline">{expense.recurrence.interval} · {expense.recurrence.intervalCount}</Badge> : expense.recurringSourceExpenseId ? <Badge variant="secondary">Vorkommen</Badge> : <span>Einmalig</span>}</td><td>{expense.category?.name ?? "–"}</td><td><div>{expense.supplier?.displayName ?? expense.marketplaceAccount?.displayName ?? "–"}</div><div className="text-xs text-muted-foreground">{expense.paymentAccount?.displayName ?? "Kein Zahlungskonto"}</div></td><td><div>{expense.incurredAt.toLocaleDateString("de-DE")}</div><div className="text-xs text-muted-foreground">fällig {expense.dueAt?.toLocaleDateString("de-DE") ?? "–"}</div></td><td className="text-right font-mono">{expense.amountNet.toFixed(2).replace(".", ",")} €</td><td className="text-right font-mono">{expense.amountGross.toFixed(2).replace(".", ",")} €</td><td><Badge variant={expense.status === "POSTED" ? "default" : expense.status === "CANCELLED" ? "destructive" : "outline"}>{expense.status}</Badge></td></tr>)}</tbody></table></div>
    <p className="text-xs text-muted-foreground">Wiederkehrende Vorkommen besitzen einen eindeutigen Occurrence-Key. Wiederholtes Materialisieren erzeugt keine doppelten Monatsbuchungen.</p>
  </div>;
}

function parseExpenseStatus(value: string | string[] | undefined): "DRAFT" | "POSTED" | "CANCELLED" | undefined {
  switch (value) {
    case "DRAFT":
    case "POSTED":
    case "CANCELLED":
      return value;
    default:
      return undefined;
  }
}
