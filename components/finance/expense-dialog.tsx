"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { createExpenseAction, materializeExpenseOccurrencesAction } from "@/lib/actions/expenses";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExpenseDialog({ categories, suppliers, paymentAccounts, marketplaceAccounts }: { categories: string[]; suppliers: Array<{ id: string; label: string }>; paymentAccounts: Array<{ id: string; label: string }>; marketplaceAccounts: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createExpenseAction, null);
  useEffect(() => { if (state?.success) { toast.success(state.success); setOpen(false); } }, [state]);
  const today = new Date().toISOString().slice(0, 10);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus /> Ausgabe anlegen</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Betriebsausgabe anlegen</DialogTitle><DialogDescription>Einmalige und wiederkehrende Fixkosten bleiben bewusst außerhalb der Produktpreisrechner.</DialogDescription></DialogHeader><form action={formAction} className="grid gap-4 sm:grid-cols-2">
    {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
    <Field label="Bezeichnung" name="description" required className="sm:col-span-2" />
    <Field label="Kategorie" name="categoryName" list="expense-categories" /><datalist id="expense-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
    <SelectField label="Lieferant" name="supplierId"><option value="">Kein Lieferant</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
    <Field label="Betrag brutto (€)" name="amountGross" required inputMode="decimal" />
    <Field label="Betrag netto (€)" name="amountNet" inputMode="decimal" placeholder="optional" />
    <Field label="Steuer (%)" name="taxRatePercent" defaultValue="19" inputMode="decimal" />
    <Field label="Zahlungsdatum" name="incurredAt" type="date" defaultValue={today} required />
    <Field label="Fälligkeit" name="dueAt" type="date" />
    <Field label="Bezahlt am" name="paidAt" type="date" />
    <SelectField label="Zahlungskonto" name="paymentAccountId"><option value="">Kein Konto</option>{paymentAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
    <SelectField label="Marktplatzkonto" name="marketplaceAccountId"><option value="">Kein Marktplatzkonto</option>{marketplaceAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
    <SelectField label="Status" name="status" defaultValue="DRAFT"><option value="DRAFT">Entwurf</option><option value="POSTED">Gebucht</option><option value="CANCELLED">Storniert</option></SelectField>
    <Field label="Beleg / Referenz" name="receiptReference" />
    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="recurring" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} /> Wiederkehrende Ausgabe</label>
    {recurring ? <><SelectField label="Intervall" name="interval" defaultValue="MONTH"><option value="DAY">Täglich</option><option value="WEEK">Wöchentlich</option><option value="MONTH">Monatlich</option><option value="QUARTER">Quartalsweise</option><option value="YEAR">Jährlich</option></SelectField><Field label="Intervallfaktor" name="intervalCount" type="number" min="1" defaultValue="1" /><Field label="Startdatum" name="startsAt" type="date" defaultValue={today} /><Field label="Enddatum" name="endsAt" type="date" /></> : null}
    <Field label="Notiz" name="notes" className="sm:col-span-2" />
    <Button type="submit" className="sm:col-span-2" disabled={pending}>{pending ? "Speichert…" : "Ausgabe speichern"}</Button>
  </form></DialogContent></Dialog>;
}

export function MaterializeExpensesButton() { const [pending, startTransition] = useTransition(); return <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await materializeExpenseOccurrencesAction(); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}><CalendarPlus />{pending ? "Erzeugt…" : "Fällige Vorkommen erzeugen"}</Button>; }
function Field({ label, name, className, ...props }: { label: string; name: string; className?: string } & React.ComponentProps<typeof Input>) { return <div className={`space-y-2 ${className ?? ""}`}><Label htmlFor={`expense-${name}`}>{label}</Label><Input id={`expense-${name}`} name={name} {...props} /></div>; }
function SelectField({ label, name, children, defaultValue }: { label: string; name: string; children: React.ReactNode; defaultValue?: string }) { return <div className="space-y-2"><Label htmlFor={`expense-${name}`}>{label}</Label><select id={`expense-${name}`} name={name} defaultValue={defaultValue} className="border-input h-9 w-full border bg-background px-3 text-sm">{children}</select></div>; }
