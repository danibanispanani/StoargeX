import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { bypassDb } from "@/lib/prisma";
import { tenantDb } from "@/lib/tenant-db";
import {
  DEBT_KIND_LABELS,
  DEBT_STATUS,
  ENTRY_STATUS,
  RETURN_STATUS,
  SALE_STATUS,
  STOCK_STATUS,
} from "@/lib/constants";
import type { TableKey } from "@/lib/import-export";

// Export der Haupttabellen als CSV oder XLSX – mit den aktuell gesetzten
// Filtern (Query-Parameter identisch zur jeweiligen Seite). Spaltennamen
// entsprechen den Import-Aliassen (Roundtrip-fähig).

export const dynamic = "force-dynamic";

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function date(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("de-DE") : "";
}

const TABLES: TableKey[] = ["lager", "verkauf", "retouren", "konsignation", "schulden", "aufgaben"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!TABLES.includes(table as TableKey)) {
    return NextResponse.json({ error: "Unbekannte Tabelle." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.activeOrgId) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const membership = await bypassDb().membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.activeOrgId,
        userId: session.user.id,
      },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const db = tenantDb(session.activeOrgId);
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  let rows: Record<string, string | number>[] = [];

  switch (table as TableKey) {
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
  }

  const filenameBase = `storagex-${table}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
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
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const escape = (value: string | number) => {
    const s = String(value);
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
