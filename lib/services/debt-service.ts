import type { Debt, DebtEntry, DebtKind, DebtStatus, Prisma } from "@prisma/client";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";

type TxMethod<Args, Result> = {
  bivarianceHack(args: Args): Promise<Result>;
}["bivarianceHack"];

type DebtLinkWithDebt = { debt: Debt } & Record<string, unknown>;

type DebtTransaction = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
  documentSequence: {
    upsert: TxMethod<unknown, { value: number }>;
  };
  debt: {
    create: TxMethod<unknown, unknown>;
    findFirst: TxMethod<unknown, unknown>;
    update: TxMethod<unknown, unknown>;
  };
  debtPurchaseLink: {
    findFirst: TxMethod<unknown, unknown>;
    create: TxMethod<unknown, unknown>;
  };
  debtSaleLink: {
    findFirst: TxMethod<unknown, unknown>;
    create: TxMethod<unknown, unknown>;
  };
  auditLog: {
    create: TxMethod<unknown, unknown>;
  };
};

export type DebtSourceType = "PURCHASE" | "SALE" | "MANUAL" | "OTHER";

export interface DebtPayload {
  date: Date;
  description: string;
  type: DebtSourceType;
  kind: DebtKind;
  quantity?: number;
  amountCents: number;
  debtorName: string;
  creditorName: string;
  status?: DebtStatus;
  entryStatus?: DebtEntry;
  settledAt?: Date | null;
  notes?: string | null;
  legacyRefId?: string | null;
}

export interface PurchaseDebtInput {
  organizationId: string;
  createdById?: string | null;
  purchaseId: string;
  purchaseNumber: string;
  purchaseDate: Date;
  vendor: string;
  paymentMethod: string;
  creditorName?: string | null;
  totalGrossCents: number;
  tx: DebtTransaction;
}

export interface SaleDebtInput {
  organizationId: string;
  createdById?: string | null;
  saleId: string;
  saleNumber: string;
  soldAt: Date;
  payoutRecipient?: string | null;
  saleGrossCents: number;
  quantity: number;
  description: string;
  tx: DebtTransaction;
}

export function resolvePurchaseDebtCreditor(paymentMethod: string): "Richard" | "Daniel" | null {
  const normalized = normalizeParty(paymentMethod);
  if (normalized === "richard") return "Richard";
  if (normalized === "daniel") return "Daniel";
  return null;
}

export function resolveSaleDebtDebtor(payoutRecipient?: string | null): "Richard" | "Daniel" | null {
  const normalized = normalizeParty(payoutRecipient);
  if (!normalized) return null;
  if (normalized === "richard" || normalized.endsWith(" r") || normalized.includes("richard")) {
    return "Richard";
  }
  if (normalized === "daniel" || normalized.endsWith(" d") || normalized.includes("daniel")) {
    return "Daniel";
  }
  return null;
}

export function shouldCreatePurchaseDebt(paymentMethod: string): boolean {
  return resolvePurchaseDebtCreditor(paymentMethod) !== null;
}

export function shouldCreateSaleDebt(payoutRecipient?: string | null): boolean {
  return resolveSaleDebtDebtor(payoutRecipient) !== null;
}

export function purchaseDebtPayload(input: Omit<PurchaseDebtInput, "tx" | "createdById">): DebtPayload | null {
  const creditor = input.creditorName?.trim() || resolvePurchaseDebtCreditor(input.paymentMethod);
  if (!creditor) return null;

  return {
    date: input.purchaseDate,
    legacyRefId: input.purchaseNumber,
    description: `Einkauf ${input.purchaseNumber} bei ${input.vendor}`,
    type: "PURCHASE",
    kind: "KAUF",
    quantity: 1,
    amountCents: input.totalGrossCents,
    debtorName: "GbR",
    creditorName: creditor,
    status: "OPEN",
    entryStatus: "IO",
  };
}

export function saleDebtPayload(input: Omit<SaleDebtInput, "tx" | "createdById">): DebtPayload | null {
  const debtor = resolveSaleDebtDebtor(input.payoutRecipient);
  if (!debtor) return null;

  return {
    date: input.soldAt,
    legacyRefId: input.saleNumber,
    description: input.description,
    type: "SALE",
    kind: "VERKAUF",
    quantity: input.quantity,
    amountCents: input.saleGrossCents,
    debtorName: debtor,
    creditorName: "GbR",
    status: "OPEN",
    entryStatus: "IO",
  };
}

export async function createManualDebt(input: {
  organizationId: string;
  createdById?: string | null;
  payload: DebtPayload;
  tx: DebtTransaction;
}): Promise<Debt> {
  const debt = await createDebtRecord(input.tx, input.organizationId, input.payload);
  await writeDebtAudit(input.tx, {
    organizationId: input.organizationId,
    userId: input.createdById ?? null,
    action: "debt.create",
    entityId: debt.id,
    after: auditAfter(debt),
  });
  return debt;
}

export async function ensurePurchaseDebt(input: PurchaseDebtInput): Promise<Debt | null> {
  const payload = purchaseDebtPayload(input);
  if (!payload) return null;

  const existing = await input.tx.debtPurchaseLink.findFirst({
    where: { organizationId: input.organizationId, purchaseId: input.purchaseId },
    include: { debt: true },
  }) as DebtLinkWithDebt | null;
  if (existing) return existing.debt;

  const debt = await createDebtRecord(input.tx, input.organizationId, payload);
  await input.tx.debtPurchaseLink.create({
    data: {
      organizationId: input.organizationId,
      debtId: debt.id,
      purchaseId: input.purchaseId,
    },
  });
  await writeDebtAudit(input.tx, {
    organizationId: input.organizationId,
    userId: input.createdById ?? null,
    action: "debt.create_purchase",
    entityId: debt.id,
    after: { ...auditAfter(debt), purchaseId: input.purchaseId },
  });
  return debt;
}

export async function reconcilePurchaseDebt(input: PurchaseDebtInput): Promise<Debt | null> {
  const payload = purchaseDebtPayload(input);
  const link = await input.tx.debtPurchaseLink.findFirst({
    where: { organizationId: input.organizationId, purchaseId: input.purchaseId },
    include: { debt: true },
  }) as DebtLinkWithDebt | null;

  if (!link) {
    return payload ? ensurePurchaseDebt(input) : null;
  }

  const linkedDebt = link.debt;
  await input.tx.$queryRaw`SELECT "id" FROM "debts" WHERE "id" = ${linkedDebt.id} AND "organization_id" = ${input.organizationId} FOR UPDATE`;
  const current = await input.tx.debt.findFirst({
    where: { id: linkedDebt.id, organizationId: input.organizationId },
  }) as Debt | null;
  if (!current) return null;

  if (current.status === "SETTLED" || current.status === "PARTIALLY_PAID") {
    throw new Error("Lieferant, Bestelldatum oder Zahlungsmethode können bei einer bereits bezahlten Schuld nicht geändert werden.");
  }
  if (!payload) {
    if (current.status === "OTHER") return current;
    return settleDebt({
      organizationId: input.organizationId,
      debtId: current.id,
      status: "OTHER",
      userId: input.createdById,
      tx: input.tx,
    });
  }

  const updated = await input.tx.debt.update({
    where: { id: current.id },
    data: {
      debtDate: payload.date,
      refId: payload.legacyRefId,
      description: payload.description,
      quantity: payload.quantity,
      amountCents: payload.amountCents,
      debtorName: payload.debtorName,
      creditorName: payload.creditorName,
      status: "OPEN",
      paidCents: 0,
      settledAt: null,
    },
  }) as Debt;
  await writeDebtAudit(input.tx, {
    organizationId: input.organizationId,
    userId: input.createdById ?? null,
    action: "debt.update_purchase",
    entityId: updated.id,
    before: auditAfter(current),
    after: auditAfter(updated),
  });
  return updated;
}

export async function ensureSaleDebt(input: SaleDebtInput): Promise<Debt | null> {
  const payload = saleDebtPayload(input);
  if (!payload) return null;

  const existing = await input.tx.debtSaleLink.findFirst({
    where: { organizationId: input.organizationId, saleId: input.saleId },
    include: { debt: true },
  }) as DebtLinkWithDebt | null;
  if (existing) return existing.debt;

  const debt = await createDebtRecord(input.tx, input.organizationId, payload);
  await input.tx.debtSaleLink.create({
    data: {
      organizationId: input.organizationId,
      debtId: debt.id,
      saleId: input.saleId,
    },
  });
  await writeDebtAudit(input.tx, {
    organizationId: input.organizationId,
    userId: input.createdById ?? null,
    action: "debt.create_sale",
    entityId: debt.id,
    after: { ...auditAfter(debt), saleId: input.saleId },
  });
  return debt;
}

export async function settleDebt(input: {
  organizationId: string;
  debtId: string;
  status: "OPEN" | "SETTLED" | "OTHER";
  settledAt?: Date | null;
  userId?: string | null;
  tx: DebtTransaction;
}): Promise<Debt | null> {
  const purchaseLink = await input.tx.debtPurchaseLink.findFirst({
    where: { organizationId: input.organizationId, debtId: input.debtId },
    select: { purchaseId: true },
  }) as { purchaseId: string } | null;
  if (purchaseLink) {
    await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${purchaseLink.purchaseId}`}))`;
  }
  await input.tx.$queryRaw`SELECT "id" FROM "debts" WHERE "id" = ${input.debtId} AND "organization_id" = ${input.organizationId} FOR UPDATE`;
  const existing = await input.tx.debt.findFirst({
    where: { id: input.debtId, organizationId: input.organizationId },
  }) as Debt | null;
  if (!existing) return null;

  if (purchaseLink && input.status !== "OTHER") {
    const currentLink = await input.tx.debtPurchaseLink.findFirst({
      where: {
        organizationId: input.organizationId,
        debtId: input.debtId,
        purchaseId: purchaseLink.purchaseId,
      },
      include: { purchase: { select: { purchaseStatus: true } } },
    }) as { purchase: { purchaseStatus: string } } | null;
    if (currentLink?.purchase.purchaseStatus === "CANCELLED") {
      throw new Error("Die Schuld einer stornierten Bestellung kann nicht wieder geöffnet oder beglichen werden.");
    }
  }

  const settledAt =
    input.status === "SETTLED" ? input.settledAt ?? existing.settledAt ?? new Date() : null;
  const debt = await input.tx.debt.update({
    where: { id: input.debtId },
    data: {
      status: input.status,
      settledAt,
      paidCents: input.status === "SETTLED" ? existing.amountCents : 0,
    },
  }) as Debt;

  await writeDebtAudit(input.tx, {
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    action: input.status === "SETTLED" ? "debt.settle" : "debt.status_change",
    entityId: debt.id,
    before: {
      status: existing.status,
      settledAt: existing.settledAt?.toISOString() ?? null,
    },
    after: {
      debtNumber: debt.debtNumber,
      status: debt.status,
      settledAt: debt.settledAt?.toISOString() ?? null,
    },
  });
  return debt;
}

async function createDebtRecord(
  tx: DebtTransaction,
  organizationId: string,
  payload: DebtPayload
): Promise<Debt> {
  if (payload.amountCents <= 0) {
    throw new Error("Schuldenbetrag muss größer als 0 sein.");
  }

  const debtNumber = (
    await reserveDocumentNumber(organizationId, "DEBT", {
      tx: tx as unknown as Prisma.TransactionClient,
      reference: payload.date,
    })
  ).display;

  return await tx.debt.create({
    data: {
      organizationId,
      debtNumber,
      debtDate: payload.date,
      refId: payload.legacyRefId ?? null,
      type: payload.type,
      kind: payload.kind,
      quantity: payload.quantity ?? 1,
      amountCents: payload.amountCents,
      paidCents: payload.status === "SETTLED" ? payload.amountCents : 0,
      debtorName: payload.debtorName,
      creditorName: payload.creditorName,
      status: payload.status ?? "OPEN",
      entryStatus: payload.entryStatus ?? "IO",
      description: payload.description,
      settledAt: payload.status === "SETTLED" ? payload.settledAt ?? new Date() : null,
      notes: payload.notes ?? null,
    },
  }) as Debt;
}

async function writeDebtAudit(
  tx: DebtTransaction,
  input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }
) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: "Debt",
      entityId: input.entityId,
      before: input.before,
      after: input.after,
    },
  });
}

function auditAfter(debt: Debt): Prisma.JsonObject {
  return {
    debtNumber: debt.debtNumber,
    debtor: debt.debtorName,
    creditor: debt.creditorName,
    amountCents: debt.amountCents,
    type: debt.type,
    kind: debt.kind,
  };
}

function normalizeParty(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}
