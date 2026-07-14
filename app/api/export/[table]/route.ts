import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveApiOrgContext } from "@/lib/org";
import {
  DEBT_KIND_LABELS,
  DEBT_STATUS,
  ENTRY_STATUS,
  RETURN_STATUS,
  SALE_STATUS,
  STOCK_STATUS,
} from "@/lib/constants";
import { encodeSpreadsheetSafeText, isTableKey } from "@/lib/import-export";
import {
  buildProductOrderBy,
  buildProductWhere,
  parseProductTableQuery,
} from "@/lib/products/product-table";
import {
  buildPurchaseOrderBy,
  buildPurchaseWhere,
  parsePurchaseTableQuery,
} from "@/lib/purchases/purchase-table";

// Export der Haupttabellen als CSV oder XLSX – mit den aktuell gesetzten
// Filtern (Query-Parameter identisch zur jeweiligen Seite). Spaltennamen
// entsprechen den Import-Aliassen (Roundtrip-fähig).

export const dynamic = "force-dynamic";
const PRODUCT_EXPORT_LIMIT = 10_000;
const PRODUCT_EXPORT_HEADERS = [
  "Name",
  "Variante",
  "Marke",
  "Kategorie",
  "EAN",
  "Standard-EK",
  "Größe",
  "Bilder",
];

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function date(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("de-DE") : "";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "Unbekannte Tabelle." }, { status: 404 });
  }

  const access = await resolveApiOrgContext();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Nicht angemeldet." : "Keine Berechtigung." },
      { status: access.status }
    );
  }
  const { db, organization } = access.context;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  let rows: Record<string, string | number>[] = [];

  switch (table) {
    case "produkte": {
      const query = parseProductTableQuery(
        Object.fromEntries(url.searchParams.entries())
      );
      const products = await db.product.findMany({
        where: buildProductWhere(query, organization.lowStockThreshold),
        orderBy: buildProductOrderBy(query),
        select: {
          name: true,
          variant: true,
          brand: true,
          category: true,
          ean: true,
          defaultPriceCents: true,
          size: true,
          imageUrls: true,
        },
        take: PRODUCT_EXPORT_LIMIT + 1,
      });
      if (products.length > PRODUCT_EXPORT_LIMIT) {
        return NextResponse.json(
          {
            error: `Der Export ist auf ${PRODUCT_EXPORT_LIMIT} Produkte begrenzt. Bitte Filter eingrenzen.`,
          },
          { status: 422 }
        );
      }
      rows = products.map((product) => ({
        Name: product.name,
        Variante: product.variant ?? "",
        Marke: product.brand ?? "",
        Kategorie: product.category ?? "",
        EAN: product.ean ?? "",
        "Standard-EK": product.defaultPriceCents == null ? "" : euro(product.defaultPriceCents),
        Größe: product.size ?? "",
        Bilder: product.imageUrls.join(", "),
      }));
      break;
    }
    case "einkauf": {
      const query = parsePurchaseTableQuery(Object.fromEntries(url.searchParams.entries()));
      const purchases = await db.purchase.findMany({
        where: buildPurchaseWhere(query),
        orderBy: buildPurchaseOrderBy(query),
        include: {
          lines: { include: { product: { select: { name: true, variant: true } } } },
        },
      });
      rows = purchases.flatMap((purchase) => purchase.lines.map((line) => ({
        Bestellnummer: purchase.supplierOrderNumber ?? purchase.purchaseNumber,
        Datum: date(purchase.purchaseDate),
        Lieferant: purchase.vendor,
        Artikel: line.product.name,
        Variante: line.product.variant ?? "",
        Menge: line.quantity,
        "Preis brutto": line.unitPriceGross.toString().replace(".", ","),
        Vorsteuer: line.vatDeductible ? "Ja" : "Nein",
        Zahlungsmethode: purchase.paymentMethod,
        "Erwartete Lieferung": date(purchase.expectedDeliveryAt),
        Trackingnummer: purchase.trackingNumber ?? "",
        Notiz: line.comment ?? purchase.comment ?? "",
      })));
      break;
    }
    case "wareneingang": {
      const receipts = await db.purchaseReceipt.findMany({
        where: q ? { purchase: { OR: [
          { purchaseNumber: { contains: q, mode: "insensitive" } },
          { vendor: { contains: q, mode: "insensitive" } },
        ] } } : undefined,
        include: {
          purchase: { select: { purchaseNumber: true, vendor: true, paymentMethod: true } },
          lines: { include: { purchaseLine: { include: { product: { select: { name: true, variant: true } } } } } },
        },
        orderBy: { receivedAt: "desc" },
      });
      rows = receipts.flatMap((receipt) => receipt.lines.map((line) => ({
        Einkaufsnummer: receipt.purchase.purchaseNumber,
        Datum: date(receipt.receivedAt),
        Lieferant: receipt.purchase.vendor,
        Artikel: line.purchaseLine.product.name,
        Variante: line.purchaseLine.product.variant ?? "",
        Menge: line.quantity,
        "Preis brutto": line.purchaseLine.unitPriceGross.toString().replace(".", ","),
        Zahlungsmethode: receipt.purchase.paymentMethod,
        Zustand: line.itemCondition ?? line.legacyCondition ?? "",
        Prüfung: line.inspectionStatus,
        Rückgabefrist: date(line.returnDeadline),
        Trackingnummer: receipt.trackingNumber ?? "",
        Notiz: line.notes ?? receipt.notes ?? "",
      })));
      break;
    }
    case "lager": {
      const status = url.searchParams.get("status");
      const zm = url.searchParams.get("zm");
      const items = await db.stockItem.findMany({
        where: {
          ...(status ? { status: status as never } : {}),
          ...(zm ? { paymentMethod: zm } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { sku: { contains: q, mode: "insensitive" } },
                  { supplier: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { listings: { include: { platform: { select: { name: true } } } } },
        orderBy: { sku: "asc" },
      });
      rows = items.map((i) => ({
        LagerID: i.sku,
        Datum: date(i.purchaseDate),
        Händler: i.supplier ?? "",
        Model: i.title,
        "Colorway/Version": i.variant ?? "",
        Size: i.size ?? "",
        Brutto: euro(i.purchasePriceCents),
        VST: i.inputTaxDeductible ? "TRUE" : "FALSE",
        Netto: i.purchaseNetCents !== null ? euro(i.purchaseNetCents) : "",
        ZM: i.paymentMethod ?? "",
        Kauf: ENTRY_STATUS[i.kaufStatus].label,
        Retoure: ENTRY_STATUS[i.retoureStatus].label,
        Status: STOCK_STATUS[i.status].label,
        EAN: i.ean ?? "",
        "Gelistet auf": i.listings.map((l) => l.platform.name).join(", "),
        Kommentar: i.notes ?? "",
      }));
      break;
    }
    case "verkauf": {
      const sales = await db.sale.findMany({
        where: q
          ? {
              OR: [
                { orderNumber: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          platform: { select: { name: true } },
          items: {
            include: {
              stockItem: { select: { sku: true, title: true } },
              consignment: { select: { sku: true, itemTitle: true } },
            },
          },
        },
        orderBy: { soldAt: "desc" },
      });
      rows = sales.map((s) => ({
        OrderID: s.orderNumber ?? "",
        Verkaufsdatum: date(s.soldAt),
        "LagerID(s)": s.items
          .map((i) => i.stockItem?.sku ?? i.consignment?.sku)
          .filter(Boolean)
          .join(", "),
        Model: [
          ...new Set(
            s.items.map((i) => i.stockItem?.title ?? i.consignment?.itemTitle).filter(Boolean)
          ),
        ].join(", "),
        Menge: s.quantity,
        "VK brutto": euro(s.salePriceCents),
        Steuern: euro(s.salePriceCents - s.saleNetCents),
        "VK netto": euro(s.saleNetCents),
        "EK netto": euro(s.items.reduce((sum, i) => sum + i.ekNetCents, 0)),
        "Plattformgebühren brutto": euro(s.platformFeeCents),
        "Plattformgebühren netto": euro(s.platformFeeNetCents),
        "Versand netto": euro(s.shippingCostCents),
        Gewinn: euro(s.profitCents),
        Gesamtstatus: SALE_STATUS[s.status]?.label ?? s.status,
        Rechnung: s.invoiceCreated ? "Erledigt" : "Offen",
        Plattform: s.platform.name,
        Versandart: s.shippingMethod ?? "",
        Land: s.buyerCountry,
        Auszahlung: s.payoutRecipient ?? "",
        Kommentar: s.notes ?? "",
      }));
      break;
    }
    case "retouren": {
      const returns = await db.return.findMany({
        include: { sale: { select: { orderNumber: true } } },
        orderBy: { requestedAt: "desc" },
      });
      rows = returns.map((r) => ({
        OrderID: r.sale.orderNumber ?? "",
        Meldedatum: date(r.requestedAt),
        Grund: r.reason ?? "",
        Erstattungsbetrag: euro(r.refundAmountCents),
        Zusatzkosten: euro(r.returnShippingCents),
        Verlust: euro(r.lossCents),
        Status: RETURN_STATUS[r.status].label,
        Kommentar: r.notes ?? "",
      }));
      break;
    }
    case "konsignation": {
      const items = await db.consignmentInventory.findMany({ orderBy: { sku: "asc" } });
      rows = items.map((c) => ({
        SKU: c.sku,
        Partnerfirma: c.consignorName,
        Artikel: c.itemTitle,
        Bestand: c.quantity,
        Verkauft: c.soldQuantity,
        Retourniert: c.returnedQuantity,
        Defekt: c.defectiveQuantity,
        Kommentar: c.notes ?? "",
      }));
      break;
    }
    case "schulden": {
      const debts = await db.debt.findMany({ orderBy: { debtDate: "desc" } });
      rows = debts.map((d) => ({
        Datum: date(d.debtDate),
        ID: d.refId ?? "",
        Artikelbeschreibung: d.description ?? "",
        Art: DEBT_KIND_LABELS[d.kind],
        Menge: d.quantity,
        Betrag: euro(d.amountCents),
        Schuldner: d.debtorName,
        Empfänger: d.creditorName,
        Status: DEBT_STATUS[d.status].label,
        Eintrag: d.entryStatus === "IO" ? "I.O" : "Fehlt",
        Begleichungsdatum: date(d.settledAt),
        Kommentar: d.notes ?? "",
      }));
      break;
    }
    case "aufgaben": {
      const tasks = await db.task.findMany({
        include: { assignee: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      rows = tasks.map((t) => ({
        Aufgabe: t.title,
        Zuständig: t.assignee ? t.assignee.name ?? t.assignee.email : "Alle",
        Frist: date(t.dueDate),
        Bereich: t.area ?? "",
        Priorität: t.priority === "HIGH" || t.priority === "URGENT" ? "Hoch" : t.priority === "MEDIUM" ? "Mittel" : "Niedrig",
        Status: t.status === "DONE" ? "Erledigt" : t.status === "IN_PROGRESS" ? "In Arbeit" : t.status === "CANCELLED" ? "Abgebrochen" : "Offen",
        Anmerkung: t.description ?? "",
      }));
      break;
    }
    case "ausgaben": {
      const expenses = await db.expense.findMany({
        include: { category: true, supplier: true, paymentAccount: true, marketplaceAccount: true, recurrence: true },
        orderBy: { incurredAt: "desc" },
      });
      rows = expenses.map((expense) => ({
        Bezeichnung: expense.description,
        Kategorie: expense.category?.name ?? "",
        Art: expense.recurrence ? "Wiederkehrend" : "Einmalig",
        Lieferant: expense.supplier?.displayName ?? "",
        "Betrag brutto": expense.amountGross.toFixed(2).replace(".", ","),
        "Betrag netto": expense.amountNet.toFixed(2).replace(".", ","),
        "Steuer (%)": expense.taxRatePercent.toFixed(2).replace(".", ","),
        Zahlungsdatum: date(expense.incurredAt),
        Fälligkeit: date(expense.dueAt),
        Zahlungskonto: expense.paymentAccount?.displayName ?? "",
        Intervall: expense.recurrence?.interval ?? "",
        Startdatum: date(expense.recurrence?.startsAt),
        Enddatum: date(expense.recurrence?.endsAt),
        Status: expense.status,
        Beleg: expense.receiptReference ?? "",
        Notiz: expense.notes ?? "",
        Marktplatzkonto: expense.marketplaceAccount?.displayName ?? "",
      }));
      break;
    }
  }

  const filenameBase = `storagex-${table}-${new Date().toISOString().slice(0, 10)}`;
  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : table === "produkte"
        ? PRODUCT_EXPORT_HEADERS
        : [];

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, table);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  // CSV: Semikolon + BOM für deutsches Excel
  const escape = (value: string | number) => {
    const raw = String(value);
    const s = typeof value === "string" ? encodeSpreadsheetSafeText(raw) : raw;
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv =
    "﻿" +
    [headers.join(";"), ...rows.map((row) => headers.map((h) => escape(row[h])).join(";"))].join(
      "\r\n"
    );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
