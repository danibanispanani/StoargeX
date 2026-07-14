"use client";

import { useActionState, useMemo, useState } from "react";
import { PlusIcon, TruckIcon, XIcon } from "lucide-react";
import {
  createPurchaseOrderAction,
  receivePurchaseAction,
  type PurchaseActionState,
} from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: PurchaseActionState = {};
type Option = { id: string; label: string };
type ProductOption = Option & { name: string };

interface OrderLineDraft {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceGross: string;
  itemCondition: string;
}

function emptyLine(): OrderLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    productName: "",
    quantity: 1,
    unitPriceGross: "",
    itemCondition: "NEW",
  };
}

export function PurchaseOrderDialog({
  suppliers,
  paymentAccounts,
  paymentMethods,
  products,
}: {
  suppliers: Option[];
  paymentAccounts: Option[];
  paymentMethods: string[];
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(createPurchaseOrderAction, initialState);
  const [lines, setLines] = useState<OrderLineDraft[]>(() => [emptyLine()]);
  const serialized = JSON.stringify(lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPriceGross: line.unitPriceGross,
    itemCondition: line.itemCondition,
    inputTaxDeductible: true,
    inputTaxRatePercent: 19,
  })));

  function updateLine(key: string, patch: Partial<OrderLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  return (
    <Dialog>
      <DialogTrigger asChild><Button><PlusIcon /> Einkauf anlegen</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bestellung erfassen</DialogTitle>
          <DialogDescription>Beschaffung zuerst erfassen; der Bestand entsteht erst beim bestätigten Wareneingang.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="lines" value={serialized} />
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Lieferant / Freitext"><Input name="vendor" placeholder="Nur nötig, wenn kein Stammlieferant gewählt ist" /></Field>
            <SelectField label="Lieferantenstamm" name="businessPartnerId" options={suppliers} placeholder="Freitext verwenden" />
            <Field label="Lieferanten-Bestellnr."><Input name="supplierOrderNumber" /></Field>
            <Field label="Bestelldatum *"><Input name="purchaseDate" type="date" required defaultValue={today()} /></Field>
            <Field label="Erwartete Lieferung"><Input name="expectedDeliveryAt" type="date" /></Field>
            <Field label="Versanddienstleister"><Input name="shippingCarrier" /></Field>
            <Field label="Trackingnummer"><Input name="trackingNumber" /></Field>
            <SelectField label="Zahlungskonto" name="paymentAccountId" options={paymentAccounts} placeholder="Kein Konto" />
            <Field label="Zahlungsmethode *">
              <select name="paymentMethod" required className="h-9 w-full border bg-background px-3 text-sm">
                <option value="">Auswählen</option>
                {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </Field>
            <Field label="Beleg / Dokument"><Input name="documentReference" placeholder="Referenz oder URL" /></Field>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">Positionen</p><p className="text-xs text-muted-foreground">Mehrere Artikel bleiben getrennte PurchaseLines.</p></div>
              <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}><PlusIcon /> Position</Button>
            </div>
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-2 border bg-muted/20 p-3 md:grid-cols-[1.2fr_1.2fr_.5fr_.7fr_.8fr_auto]">
                <Field label="Katalogprodukt">
                  <select value={line.productId} onChange={(event) => {
                    const product = products.find((item) => item.id === event.target.value);
                    updateLine(line.key, { productId: event.target.value, productName: product?.name ?? line.productName });
                  }} className="h-9 w-full border bg-background px-2 text-sm">
                    <option value="">Neu / Freitext</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
                  </select>
                </Field>
                <Field label={`Artikel ${index + 1} *`}><Input value={line.productName} required onChange={(event) => updateLine(line.key, { productName: event.target.value })} /></Field>
                <Field label="Menge *"><Input type="number" min={1} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} /></Field>
                <Field label="EK brutto *"><Input inputMode="decimal" value={line.unitPriceGross} onChange={(event) => updateLine(line.key, { unitPriceGross: event.target.value })} /></Field>
                <Field label="Zustand">
                  <select value={line.itemCondition} onChange={(event) => updateLine(line.key, { itemCondition: event.target.value })} className="h-9 w-full border bg-background px-2 text-sm">
                    <option value="NEW">Neu</option><option value="OPEN_BOX">Geöffnet</option><option value="REFURBISHED">Refurbished</option><option value="USED">Gebraucht</option><option value="DEFECTIVE">Defekt</option>
                  </select>
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Position entfernen" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><XIcon /></Button>
              </div>
            ))}
          </div>
          <Field label="Notizen"><textarea name="comment" rows={3} className="w-full border bg-background p-2 text-sm" /></Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end"><Button disabled={pending}>{pending ? "Speichert…" : "Bestellung anlegen"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PurchaseReceiptDialog({ purchaseId, purchaseNumber, lines }: {
  purchaseId: string;
  purchaseNumber: string;
  lines: Array<{ id: string; label: string; openQuantity: number }>;
}) {
  const [state, action, pending] = useActionState(receivePurchaseAction, initialState);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(lines.map((line) => [line.id, line.openQuantity]))
  );
  const [inspectionStatus, setInspectionStatus] = useState("PASSED");
  const serialized = useMemo(() => JSON.stringify(lines
    .filter((line) => (quantities[line.id] ?? 0) > 0)
    .map((line) => ({
      purchaseLineId: line.id,
      quantity: quantities[line.id],
      inspectionStatus,
    }))), [inspectionStatus, lines, quantities]);

  if (lines.length === 0) return <span className="text-xs text-muted-foreground">Vollständig eingegangen</span>;
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><TruckIcon /> Eingang</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Wareneingang {purchaseNumber}</DialogTitle><DialogDescription>Nur bestätigte Mengen werden als Lots und Bewegungen gebucht.</DialogDescription></DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <input type="hidden" name="lines" value={serialized} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tatsächlicher Eingang *"><Input name="receivedAt" type="date" required defaultValue={today()} /></Field>
            <Field label="Prüfergebnis">
              <select value={inspectionStatus} onChange={(event) => setInspectionStatus(event.target.value)} className="h-9 w-full border bg-background px-3 text-sm">
                <option value="PASSED">Bestanden / verfügbar</option><option value="PENDING">Prüfung offen</option><option value="DEFECTIVE">Defekt</option>
              </select>
            </Field>
            <Field label="Rückgabefenster (Tage)"><Input name="returnWindowDays" type="number" min={0} defaultValue={30} /></Field>
            <Field label="Explizite Rückgabefrist"><Input name="returnDeadline" type="date" /></Field>
            <Field label="Versanddienstleister"><Input name="shippingCarrier" /></Field>
            <Field label="Trackingnummer"><Input name="trackingNumber" /></Field>
            <Field label="Beleg / Dokument"><Input name="documentReference" /></Field>
          </div>
          <div className="space-y-2">
            {lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 border p-3"><span className="text-sm">{line.label} <span className="text-muted-foreground">· offen {line.openQuantity}</span></span><Input aria-label={`Eingangsmenge ${line.label}`} type="number" min={0} max={line.openQuantity} value={quantities[line.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: Number(event.target.value) }))} /></div>)}
          </div>
          <Field label="Notizen"><textarea name="notes" rows={2} className="w-full border bg-background p-2 text-sm" /></Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end"><Button disabled={pending}>{pending ? "Bucht…" : "Wareneingang buchen"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
function SelectField({ label, name, options, placeholder }: { label: string; name: string; options: Option[]; placeholder: string }) {
  return <Field label={label}><select name={name} className="h-9 w-full border bg-background px-3 text-sm"><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>;
}
function ActionFeedback({ state }: { state: PurchaseActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state.success) return <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
  return null;
}
function today() { return new Date().toISOString().slice(0, 10); }
