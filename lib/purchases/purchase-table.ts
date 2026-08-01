import type { Prisma } from "@prisma/client";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  parseTablePageSize,
  type TablePageSize,
} from "@/lib/operational-table";

export const PURCHASE_TABLE_DEFINITION = {
  key: "purchases",
  path: "/einkauf",
  columns: [
    { key: "purchaseNumber", label: "Einkauf", defaultVisible: true, sortable: true },
    { key: "purchaseDate", label: "Bestelldatum", defaultVisible: true, sortable: true },
    { key: "supplier", label: "Lieferant", defaultVisible: true, sortable: true },
    { key: "status", label: "Bestellstatus", defaultVisible: true, sortable: true },
    { key: "shipping", label: "Versand", defaultVisible: true, sortable: true },
    { key: "lines", label: "Positionen", defaultVisible: true, sortable: false },
    { key: "amounts", label: "Brutto / Netto", defaultVisible: true, sortable: true },
    { key: "paymentMethod", label: "Zahlungsmethode", defaultVisible: true, sortable: false },
    { key: "expectedDelivery", label: "Erwartet", defaultVisible: false, sortable: true },
    { key: "receivedAt", label: "Eingetroffen", defaultVisible: false, sortable: true },
    { key: "returnDeadline", label: "Rückgabefrist", defaultVisible: false, sortable: true },
    { key: "supplierOrder", label: "Lieferantenbestellung", defaultVisible: false, sortable: true },
    { key: "tracking", label: "Tracking", defaultVisible: false, sortable: false },
    { key: "tax", label: "Steuer", defaultVisible: false, sortable: false },
    { key: "debt", label: "Schuld", defaultVisible: false, sortable: false },
    { key: "comment", label: "Notiz", defaultVisible: false, sortable: false },
  ],
  presets: [
    { key: "standard", label: "Standard" },
    { key: "open", label: "Offen" },
    { key: "in-transit", label: "Unterwegs" },
    { key: "received", label: "Eingetroffen" },
    { key: "deadlines", label: "Rückgabefristen" },
    { key: "finance", label: "Finanzen" },
    { key: "all", label: "Alle" },
  ],
} as const;

export type PurchasePreset = (typeof PURCHASE_TABLE_DEFINITION.presets)[number]["key"];
export type PurchaseSort = "purchaseNumber" | "purchaseDate" | "supplier" | "status" | "shipping" | "amounts" | "expectedDelivery" | "receivedAt" | "returnDeadline" | "supplierOrder";
export interface PurchaseTableQuery {
  q: string;
  supplier: string;
  from: string;
  to: string;
  preset: PurchasePreset;
  sort: PurchaseSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: TablePageSize;
}

type SearchParams = Record<string, string | string[] | undefined>;

export function parsePurchaseTableQuery(params: SearchParams): PurchaseTableQuery {
  const presetKeys = new Set<PurchasePreset>(PURCHASE_TABLE_DEFINITION.presets.map((item) => item.key));
  const sortKeys = new Set<PurchaseSort>([
    "purchaseNumber", "purchaseDate", "supplier", "status", "shipping", "amounts",
    "expectedDelivery", "receivedAt", "returnDeadline", "supplierOrder",
  ]);
  const requestedPreset = valueOf(params.preset) as PurchasePreset;
  return {
    q: valueOf(params.q).trim(),
    supplier: valueOf(params.supplier).trim(),
    from: validDate(valueOf(params.from)),
    to: validDate(valueOf(params.to)),
    preset: presetKeys.has(requestedPreset) ? requestedPreset : "standard",
    sort: sortKeys.has(valueOf(params.sort) as PurchaseSort) ? valueOf(params.sort) as PurchaseSort : "purchaseDate",
    direction: valueOf(params.direction) === "asc" ? "asc" : "desc",
    page: positiveInt(valueOf(params.page)) || 1,
    pageSize: parseTablePageSize(valueOf(params.pageSize)),
  };
}

export function buildPurchaseWhere(query: PurchaseTableQuery, now = new Date()): Prisma.PurchaseWhereInput {
  void now;
  const where: Prisma.PurchaseWhereInput = {
    ...(query.q ? {
      OR: [
        { purchaseNumber: { contains: query.q, mode: "insensitive" } },
        { supplierOrderNumber: { contains: query.q, mode: "insensitive" } },
        { vendor: { contains: query.q, mode: "insensitive" } },
        { comment: { contains: query.q, mode: "insensitive" } },
        { trackingNumber: { contains: query.q, mode: "insensitive" } },
        { lines: { some: { product: { name: { contains: query.q, mode: "insensitive" } } } } },
      ],
    } : {}),
    ...(query.supplier ? { businessPartnerId: query.supplier } : {}),
    ...(query.from || query.to ? {
      purchaseDate: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      },
    } : {}),
  };
  if (query.preset === "open" || query.preset === "standard") {
    where.purchaseStatus = { in: ["DRAFT", "CONFIRMED", "ORDERED", "PARTIALLY_RECEIVED"] };
  } else if (query.preset === "in-transit") {
    where.shippingStatus = { in: ["READY", "SHIPPED", "PARTIALLY_RECEIVED"] };
  } else if (query.preset === "received") {
    where.purchaseStatus = "RECEIVED";
  } else if (query.preset === "deadlines") {
    where.returnDeadline = { not: null };
    where.purchaseStatus = { not: "CANCELLED" };
  } else if (query.preset === "finance") {
    const search = where.OR;
    delete where.OR;
    where.AND = [
      ...(search ? [{ OR: search }] : []),
      { debtLinks: { some: {} } },
    ];
  }
  return where;
}

export function buildPurchaseOrderBy(query: PurchaseTableQuery): Prisma.PurchaseOrderByWithRelationInput[] {
  const field = query.sort === "supplier" ? "vendor"
    : query.sort === "status" ? "purchaseStatus"
    : query.sort === "shipping" ? "shippingStatus"
    : query.sort === "expectedDelivery" ? "expectedDeliveryAt"
    : query.sort === "supplierOrder" ? "supplierOrderNumber"
    : query.sort === "amounts" ? "purchaseDate"
    : query.sort;
  return [{ [field]: query.direction }, { id: "asc" }];
}

export function purchaseQueryToSearchParams(query: PurchaseTableQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.supplier) params.set("supplier", query.supplier);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.preset !== "standard") params.set("preset", query.preset);
  if (query.sort !== "purchaseDate") params.set("sort", query.sort);
  if (query.direction !== "desc") params.set("direction", query.direction);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_TABLE_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  return params;
}

function valueOf(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function positiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
function validDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
