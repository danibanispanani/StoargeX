"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TruckIcon,
  XIcon,
} from "lucide-react";
import type { PurchaseShippingStatus, PurchaseStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createPurchaseOrderAction,
  createPurchaseSupplierAction,
  deletePurchaseSupplierAction,
  receivePurchaseAction,
  renamePurchaseSupplierAction,
  updatePurchaseAction,
  type PurchaseActionState,
} from "@/lib/actions/purchases";
import {
  DEFAULT_PURCHASE_STATUS,
  PURCHASE_SHIPPING_STATUS_LABELS,
  PURCHASE_SHIPPING_STATUS_VALUES,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VALUES,
  RETURN_WINDOW_DAYS,
} from "@/lib/purchases/purchase-workflow";
import { ActionIconButton } from "@/components/ui/action-icon-button";
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
type ProductOption = Option & { name: string; imageUrl: string };

interface OrderLineDraft {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceGross: string;
  itemCondition: string;
  imageUrl: string;
}

interface OrderFormDraft {
  vendor: string;
  supplierOrderNumber: string;
  purchaseDate: string;
  expectedDeliveryAt: string;
  shippingCarrier: string;
  trackingNumber: string;
  paymentMethod: string;
  comment: string;
}

function emptyLine(): OrderLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    productName: "",
    quantity: 1,
    unitPriceGross: "",
    itemCondition: "NEW",
    imageUrl: "",
  };
}

function emptyOrder(): OrderFormDraft {
  return {
    vendor: "",
    supplierOrderNumber: "",
    purchaseDate: today(),
    expectedDeliveryAt: "",
    shippingCarrier: "",
    trackingNumber: "",
    paymentMethod: "",
    comment: "",
  };
}

export function PurchaseOrderDialog({
  suppliers,
  paymentMethods,
  products,
}: {
  suppliers: Option[];
  paymentMethods: string[];
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPurchaseOrderAction, initialState);
  const [draft, setDraft] = useState<OrderFormDraft>(emptyOrder);
  const [lines, setLines] = useState<OrderLineDraft[]>(() => [emptyLine()]);
  const serialized = JSON.stringify(lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPriceGross: line.unitPriceGross,
    itemCondition: line.itemCondition,
    imageUrl: line.imageUrl,
    inputTaxDeductible: true,
    inputTaxRatePercent: 19,
  })));

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    setOpen(false);
    setDraft(emptyOrder());
    setLines([emptyLine()]);
  }, [state]);

  function updateLine(key: string, patch: Partial<OrderLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function updateDraft<K extends keyof OrderFormDraft>(field: K, value: OrderFormDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PlusIcon /> Einkauf anlegen</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bestellung erfassen</DialogTitle>
          <DialogDescription>Beschaffung erfassen; der Bestand entsteht erst beim gebuchten Wareneingang.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="lines" value={serialized} />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <SupplierPicker suppliers={suppliers} value={draft.vendor} onChange={(value) => updateDraft("vendor", value)} />
            </div>
            <Field label="Lieferanten-Bestellnr."><Input name="supplierOrderNumber" value={draft.supplierOrderNumber} onChange={(event) => updateDraft("supplierOrderNumber", event.target.value)} /></Field>
            <Field label="Bestelldatum *"><Input name="purchaseDate" type="date" required value={draft.purchaseDate} onChange={(event) => updateDraft("purchaseDate", event.target.value)} /></Field>
            <Field label="Erwartete Lieferung"><Input name="expectedDeliveryAt" type="date" value={draft.expectedDeliveryAt} onChange={(event) => updateDraft("expectedDeliveryAt", event.target.value)} /></Field>
            <Field label="Versanddienstleister"><Input name="shippingCarrier" value={draft.shippingCarrier} onChange={(event) => updateDraft("shippingCarrier", event.target.value)} /></Field>
            <Field label="Trackingnummer"><Input name="trackingNumber" value={draft.trackingNumber} onChange={(event) => updateDraft("trackingNumber", event.target.value)} /></Field>
            <Field label="Zahlungsmethode *">
              <select name="paymentMethod" required value={draft.paymentMethod} onChange={(event) => updateDraft("paymentMethod", event.target.value)} className="h-9 w-full border bg-background px-3 text-sm">
                <option value="">Auswählen</option>
                {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                {!paymentMethods.includes("Sonstiges") ? <option value="Sonstiges">Sonstiges</option> : null}
              </select>
            </Field>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-medium">Positionen</p><p className="text-xs text-muted-foreground">Bildadressen werden am jeweiligen Produkt gespeichert und überall weiterverwendet.</p></div>
              <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}><PlusIcon /> Position</Button>
            </div>
            {lines.map((line, index) => (
              <div key={line.key} className="relative grid gap-3 border bg-muted/20 p-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Field label="Katalogprodukt">
                    <select value={line.productId} onChange={(event) => {
                      const product = products.find((item) => item.id === event.target.value);
                      updateLine(line.key, {
                        productId: event.target.value,
                        productName: product?.name ?? line.productName,
                        imageUrl: product?.imageUrl ?? line.imageUrl,
                      });
                    }} className="h-9 w-full border bg-background px-2 text-sm">
                      <option value="">Neu / Freitext</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="md:col-span-4"><Field label={`Artikel ${index + 1} *`}><Input value={line.productName} required onChange={(event) => updateLine(line.key, { productName: event.target.value })} /></Field></div>
                <div className="md:col-span-1"><Field label="Menge *"><Input type="number" min={1} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} /></Field></div>
                <div className="md:col-span-2"><Field label="EK brutto *"><Input inputMode="decimal" value={line.unitPriceGross} onChange={(event) => updateLine(line.key, { unitPriceGross: event.target.value })} /></Field></div>
                <div className="md:col-span-2">
                  <Field label="Zustand">
                    <select value={line.itemCondition} onChange={(event) => updateLine(line.key, { itemCondition: event.target.value })} className="h-9 w-full border bg-background px-2 text-sm">
                      <option value="NEW">Neu</option><option value="OPEN_BOX">Geöffnet</option><option value="REFURBISHED">Refurbished</option><option value="USED">Gebraucht</option><option value="DEFECTIVE">Defekt</option>
                    </select>
                  </Field>
                </div>
                <div className="space-y-1 md:col-span-11">
                  <Field label="Bildadresse des Produkts"><Input type="url" value={line.imageUrl} onChange={(event) => updateLine(line.key, { imageUrl: event.target.value })} placeholder="https://…/artikelbild.jpg" /></Field>
                  <p className="text-xs text-muted-foreground">Direkten öffentlichen Bild-Link einfügen: Bild öffnen, Rechtsklick, „Bildadresse kopieren“.</p>
                </div>
                <div className="flex items-end justify-end md:col-span-1">
                  <ActionIconButton label="Position entfernen" icon={XIcon} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} />
                </div>
              </div>
            ))}
          </div>
          <Field label="Notizen"><textarea name="comment" value={draft.comment} onChange={(event) => updateDraft("comment", event.target.value)} rows={3} className="w-full border bg-background p-2 text-sm" /></Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end"><Button disabled={pending}>{pending ? "Speichert…" : "Bestellung anlegen"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReceiptLineOption {
  id: string;
  label: string;
  openQuantity: number;
}

function receiptQuantities(lines: readonly ReceiptLineOption[]): Record<string, number> {
  return Object.fromEntries(lines.map((line) => [line.id, line.openQuantity]));
}

export function PurchaseReceiptDialog({ purchaseId, purchaseNumber, lines }: {
  purchaseId: string;
  purchaseNumber: string;
  lines: ReceiptLineOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(receivePurchaseAction, initialState);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => receiptQuantities(lines));
  const [receivedAt, setReceivedAt] = useState(today());
  const [returnWindowDays, setReturnWindowDays] = useState("30");
  const [notes, setNotes] = useState("");
  const serialized = useMemo(() => JSON.stringify(lines
    .filter((line) => (quantities[line.id] ?? 0) > 0)
    .map((line) => ({ purchaseLineId: line.id, quantity: quantities[line.id] }))), [lines, quantities]);

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    setOpen(false);
  }, [state]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setQuantities(receiptQuantities(lines));
      setReceivedAt(today());
      setReturnWindowDays("30");
      setNotes("");
    }
    setOpen(nextOpen);
  }

  if (lines.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><TruckIcon /> Eingang buchen</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Wareneingang {purchaseNumber}</DialogTitle><DialogDescription>Nur bestätigte Mengen werden als Lots und Bewegungen gebucht.</DialogDescription></DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <input type="hidden" name="lines" value={serialized} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tatsächlicher Eingang *"><Input name="receivedAt" type="date" required value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></Field>
            <Field label="Rückgabefrist">
              <select name="returnWindowDays" value={returnWindowDays} onChange={(event) => setReturnWindowDays(event.target.value)} className="h-9 w-full border bg-background px-3 text-sm">
                {RETURN_WINDOW_DAYS.map((days) => <option key={days} value={days}>{days} Tage</option>)}
              </select>
            </Field>
          </div>
          <div className="space-y-2">
            {lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 border p-3"><span className="text-sm">{line.label} <span className="text-muted-foreground">· offen {line.openQuantity}</span></span><Input aria-label={`Eingangsmenge ${line.label}`} type="number" min={0} max={line.openQuantity} value={quantities[line.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: Number(event.target.value) }))} /></div>)}
          </div>
          <Field label="Notizen"><textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full border bg-background p-2 text-sm" /></Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end"><Button disabled={pending}>{pending ? "Bucht…" : "Wareneingang buchen"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface EditablePurchase {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplier: string;
  supplierOrderNumber: string;
  expectedDeliveryAt: string | null;
  shippingCarrier: string;
  trackingNumber: string;
  paymentMethod: string;
  status: PurchaseStatus;
  shippingStatus: PurchaseShippingStatus;
  comment: string;
}

interface PurchaseEditDraft {
  vendor: string;
  purchaseDate: string;
  expectedDeliveryAt: string;
  supplierOrderNumber: string;
  paymentMethod: string;
  shippingCarrier: string;
  trackingNumber: string;
  purchaseStatus: (typeof PURCHASE_STATUS_VALUES)[number];
  shippingStatus: (typeof PURCHASE_SHIPPING_STATUS_VALUES)[number];
  comment: string;
}

function editDraftFromPurchase(purchase: EditablePurchase): PurchaseEditDraft {
  return {
    vendor: purchase.supplier,
    purchaseDate: purchase.purchaseDate.slice(0, 10),
    expectedDeliveryAt: purchase.expectedDeliveryAt?.slice(0, 10) ?? "",
    supplierOrderNumber: purchase.supplierOrderNumber,
    paymentMethod: purchase.paymentMethod,
    shippingCarrier: purchase.shippingCarrier,
    trackingNumber: purchase.trackingNumber,
    purchaseStatus: purchase.status === "DRAFT" || purchase.status === "CANCELLED"
      ? DEFAULT_PURCHASE_STATUS
      : purchase.status,
    shippingStatus: purchase.shippingStatus === "READY" ? "NOT_SHIPPED" : purchase.shippingStatus,
    comment: purchase.comment,
  };
}

export function PurchaseEditDialog({ purchase, suppliers, paymentMethods }: {
  purchase: EditablePurchase;
  suppliers: Option[];
  paymentMethods: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updatePurchaseAction, initialState);
  const [draft, setDraft] = useState<PurchaseEditDraft>(() => editDraftFromPurchase(purchase));

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    setOpen(false);
  }, [state]);

  function setField<K extends keyof PurchaseEditDraft>(field: K, value: PurchaseEditDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setDraft(editDraftFromPurchase(purchase));
    setOpen(nextOpen);
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild><ActionIconButton label="Einkauf bearbeiten" icon={PencilIcon} /></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{purchase.purchaseNumber} bearbeiten</DialogTitle>
        <DialogDescription>Tracking, Versand und Status können ergänzt werden, sobald die Angaben bekannt sind.</DialogDescription>
      </DialogHeader>
      <form action={action} className="space-y-4">
        <input type="hidden" name="purchaseId" value={purchase.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><SupplierPicker suppliers={suppliers} value={draft.vendor} onChange={(value) => setField("vendor", value)} /></div>
          <Field label="Bestelldatum *"><Input name="purchaseDate" type="date" required value={draft.purchaseDate} onChange={(event) => setField("purchaseDate", event.target.value)} /></Field>
          <Field label="Erwartete Lieferung"><Input name="expectedDeliveryAt" type="date" value={draft.expectedDeliveryAt} onChange={(event) => setField("expectedDeliveryAt", event.target.value)} /></Field>
          <Field label="Lieferanten-Bestellnr."><Input name="supplierOrderNumber" value={draft.supplierOrderNumber} onChange={(event) => setField("supplierOrderNumber", event.target.value)} /></Field>
          <Field label="Zahlungsmethode *">
            <select name="paymentMethod" required value={draft.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value)} className="h-9 w-full border bg-background px-3 text-sm">
              <option value="">Auswählen</option>
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
              {!paymentMethods.includes(purchase.paymentMethod) && purchase.paymentMethod ? <option value={purchase.paymentMethod}>{purchase.paymentMethod}</option> : null}
              {!paymentMethods.includes("Sonstiges") ? <option value="Sonstiges">Sonstiges</option> : null}
            </select>
          </Field>
          <Field label="Versanddienstleister"><Input name="shippingCarrier" value={draft.shippingCarrier} onChange={(event) => setField("shippingCarrier", event.target.value)} /></Field>
          <Field label="Trackingnummer"><Input name="trackingNumber" value={draft.trackingNumber} onChange={(event) => setField("trackingNumber", event.target.value)} /></Field>
          <Field label="Bestellstatus">
            <select name="purchaseStatus" value={draft.purchaseStatus} onChange={(event) => setField("purchaseStatus", event.target.value as PurchaseEditDraft["purchaseStatus"])} className="h-9 w-full border bg-background px-3 text-sm">
              {PURCHASE_STATUS_VALUES.map((status) => <option key={status} value={status}>{PURCHASE_STATUS_LABELS[status]}</option>)}
            </select>
          </Field>
          <Field label="Versandstatus">
            <select name="shippingStatus" value={draft.shippingStatus} onChange={(event) => setField("shippingStatus", event.target.value as PurchaseEditDraft["shippingStatus"])} className="h-9 w-full border bg-background px-3 text-sm">
              {PURCHASE_SHIPPING_STATUS_VALUES.map((status) => <option key={status} value={status}>{PURCHASE_SHIPPING_STATUS_LABELS[status]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notizen"><textarea name="comment" value={draft.comment} onChange={(event) => setField("comment", event.target.value)} rows={3} className="w-full border bg-background p-2 text-sm" /></Field>
        <ActionFeedback state={state} />
        <div className="flex justify-end"><Button disabled={pending}>{pending ? "Speichert…" : "Änderungen speichern"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

function SupplierPicker({ suppliers, value, onChange }: {
  suppliers: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [items, setItems] = useState(suppliers);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pending, startTransition] = useTransition();
  const normalized = value.trim().toLocaleLowerCase("de-DE");
  const exactMatch = items.some((item) => item.label.toLocaleLowerCase("de-DE") === normalized);
  const visibleItems = exactMatch || !normalized
    ? items
    : items.filter((item) => item.label.toLocaleLowerCase("de-DE").includes(normalized));

  useEffect(() => {
    setItems(suppliers);
  }, [suppliers]);

  function addSupplier() {
    startTransition(async () => {
      const result = await createPurchaseSupplierAction(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.supplier) return;
      setItems((current) => [...current.filter((item) => item.id !== result.supplier?.id), result.supplier!].sort((a, b) => a.label.localeCompare(b.label, "de")));
      onChange(result.supplier.label);
      if (result.success) toast.success(result.success);
    });
  }

  function renameSupplier(id: string) {
    startTransition(async () => {
      const result = await renamePurchaseSupplierAction(id, editingName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.supplier) return;
      setItems((current) => current.map((item) => item.id === id ? result.supplier! : item).sort((a, b) => a.label.localeCompare(b.label, "de")));
      if (items.find((item) => item.id === id)?.label === value) onChange(result.supplier.label);
      setEditingId(null);
      if (result.success) toast.success(result.success);
    });
  }

  function removeSupplier(item: Option) {
    if (!confirm(`Lieferant „${item.label}“ aus der Auswahl entfernen? Bestehende Einkäufe bleiben unverändert.`)) return;
    startTransition(async () => {
      const result = await deletePurchaseSupplierAction(item.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (value === item.label) onChange("");
      if (result.success) toast.success(result.success);
    });
  }

  return <div className="relative space-y-1">
    <Label>Lieferant *</Label>
    <div className="flex">
      <Input name="vendor" required value={value} onFocus={() => setExpanded(true)} onChange={(event) => { onChange(event.target.value); setExpanded(true); }} placeholder="Lieferant wählen oder frei eingeben" className="rounded-r-none" autoComplete="off" />
      <Button type="button" variant="outline" size="icon" aria-label="Lieferantenauswahl öffnen" className="rounded-l-none border-l-0" onClick={() => setExpanded((current) => !current)}><ChevronDownIcon /></Button>
    </div>
    {expanded ? <div className="absolute z-40 mt-1 w-full min-w-72 border bg-popover p-1 text-popover-foreground shadow-lg">
      <div className="max-h-56 overflow-y-auto">
        {visibleItems.length ? visibleItems.map((item) => <div key={item.id} className="flex min-h-9 items-center gap-1 px-1 hover:bg-muted/60">
          {editingId === item.id ? <>
            <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-7 flex-1" autoFocus />
            <ActionIconButton label="Lieferantenname speichern" icon={CheckIcon} disabled={pending} onClick={() => renameSupplier(item.id)} />
            <ActionIconButton label="Bearbeitung abbrechen" icon={XIcon} disabled={pending} onClick={() => setEditingId(null)} />
          </> : <>
            <button type="button" className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm" onClick={() => { onChange(item.label); setExpanded(false); }}>{item.label}</button>
            <ActionIconButton label={`${item.label} bearbeiten`} icon={PencilIcon} disabled={pending} onClick={() => { setEditingId(item.id); setEditingName(item.label); }} />
            <ActionIconButton label={`${item.label} entfernen`} icon={Trash2Icon} className="text-destructive" disabled={pending} onClick={() => removeSupplier(item)} />
          </>}
        </div>) : <p className="px-3 py-2 text-sm text-muted-foreground">Kein gespeicherter Lieferant gefunden.</p>}
      </div>
      {!exactMatch && value.trim() ? <div className="border-t p-1 pt-2">
        <Button type="button" variant="ghost" className="w-full justify-start" disabled={pending} onClick={addSupplier}><PlusIcon /> „{value.trim()}“ als Lieferant speichern</Button>
      </div> : null}
      <button type="button" className="w-full border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => setExpanded(false)}>Auswahl schließen</button>
    </div> : null}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
function ActionFeedback({ state }: { state: PurchaseActionState }) {
  if (state.error) return <p role="alert" className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{state.error}</p>;
  return null;
}
function today() { return new Date().toISOString().slice(0, 10); }
