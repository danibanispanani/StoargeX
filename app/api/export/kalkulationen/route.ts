import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveApiOrgContext } from "@/lib/org";
import { encodeSpreadsheetSafeText } from "@/lib/import-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await resolveApiOrgContext();
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? "Nicht angemeldet." : "Keine Berechtigung." }, { status: access.status });
  const { db } = access.context;
  const url = new URL(request.url);
  const marketplaceCode = url.searchParams.get("marketplaceCode");
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const calculations = await db.marketplacePricingCalculation.findMany({
    where: marketplaceCode ? { marketplaceCode } : undefined,
    include: { product: true, marketplaceAccount: true, feeCategory: true, feeSchedule: true },
    orderBy: { calculatedAt: "desc" },
    take: 10_000,
  });
  const rows = calculations.map((item) => ({
    Produkt: item.product?.name ?? "Freie Kalkulation",
    Marktplatz: item.marketplaceCode,
    Konto: item.marketplaceAccount?.displayName ?? "",
    Kategorie: item.feeCategory.officialName,
    "Kategorie-ID": item.feeCategory.externalCategoryId ?? "",
    Einkaufspreis: euro(item.purchasePriceCents),
    "Erwarteter Verkaufspreis": euro(item.expectedSalePriceCents),
    Gewinn: euro(item.profitCents),
    Marge: euro(item.marginCents),
    "Mindestpreis ohne Verlust": euro(item.breakEvenCents),
    Auszahlung: euro(item.expectedPayoutCents),
    Status: item.status,
    Veraltet: item.stale ? "Ja" : "Nein",
    Katalogversion: item.feeSchedule.version ?? "",
    Berechnet: item.calculatedAt.toISOString(),
  }));
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const base = `storagex-kalkulationen-${new Date().toISOString().slice(0, 10)}`;
  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kalkulationen");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
  }
  const escape = (value: string) => { const safe = encodeSpreadsheetSafeText(value); return /[";\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe; };
  const csv = `\uFEFF${[headers.join(";"), ...rows.map((row) => headers.map((header) => escape(String(row[header as keyof typeof row]))).join(";"))].join("\r\n")}`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
}

function euro(cents: number) { return (cents / 100).toFixed(2).replace(".", ","); }
