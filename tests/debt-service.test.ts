import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  createManualDebt,
  ensurePurchaseDebt,
  ensureSaleDebt,
  purchaseDebtPayload,
  resolvePurchaseDebtCreditor,
  resolveSaleDebtDebtor,
  saleDebtPayload,
  settleDebt,
} from "@/lib/services/debt-service";

type MockDebt = Record<string, unknown> & {
  id: string;
  organizationId: string;
  amountCents: number;
  paidCents: number;
  status: string;
  settledAt: Date | null;
};

type MockLink = Record<string, unknown> & {
  id: string;
  organizationId: string;
  debtId: string;
};

type MockCreateArgs = { data: Record<string, unknown> };
type MockFindArgs = {
  where: Record<string, unknown>;
  include?: Record<string, unknown>;
};
type MockUpdateArgs = {
  where: { id: string };
  data: Record<string, unknown>;
};

function createDebtTx() {
  let sequence = 0;
  let debtIndex = 0;
  let linkIndex = 0;
  const debts: MockDebt[] = [];
  const purchaseLinks: MockLink[] = [];
  const saleLinks: MockLink[] = [];
  const auditLogs: Record<string, unknown>[] = [];

  const tx = {
    documentSequence: {
      upsert: async () => ({ value: ++sequence }),
    },
    debt: {
      create: async ({ data }: MockCreateArgs) => {
        const debt = {
          id: `debt-${++debtIndex}`,
          paidCents: 0,
          dueDate: null,
          settledAt: null,
          notes: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          ...data,
        } as unknown as MockDebt;
        debts.push(debt);
        return debt;
      },
      findFirst: async ({ where }: MockFindArgs) =>
        debts.find(
          (debt) =>
            (!where.id || debt.id === where.id) &&
            (!where.organizationId || debt.organizationId === where.organizationId)
        ) ?? null,
      update: async ({ where, data }: MockUpdateArgs) => {
        const debt = debts.find((item) => item.id === where.id);
        if (!debt) throw new Error("debt not found");
        Object.assign(debt, data, { updatedAt: new Date("2026-01-02T00:00:00.000Z") });
        return debt;
      },
    },
    debtPurchaseLink: {
      findFirst: async ({ where, include }: MockFindArgs) => {
        const link = purchaseLinks.find(
          (item) =>
            item.organizationId === where.organizationId && item.purchaseId === where.purchaseId
        );
        if (!link) return null;
        return include?.debt ? { ...link, debt: debts.find((debt) => debt.id === link.debtId) } : link;
      },
      create: async ({ data }: MockCreateArgs) => {
        const link = { id: `purchase-link-${++linkIndex}`, ...data };
        purchaseLinks.push(link as MockLink);
        return link;
      },
    },
    debtSaleLink: {
      findFirst: async ({ where, include }: MockFindArgs) => {
        const link = saleLinks.find(
          (item) => item.organizationId === where.organizationId && item.saleId === where.saleId
        );
        if (!link) return null;
        return include?.debt ? { ...link, debt: debts.find((debt) => debt.id === link.debtId) } : link;
      },
      create: async ({ data }: MockCreateArgs) => {
        const link = { id: `sale-link-${++linkIndex}`, ...data };
        saleLinks.push(link as MockLink);
        return link;
      },
    },
    auditLog: {
      create: async ({ data }: MockCreateArgs) => {
        auditLogs.push(data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, debts, purchaseLinks, saleLinks, auditLogs };
}

describe("debt domain service", () => {
  it("Kauf Richard erzeugt genau eine Schuld", async () => {
    const state = createDebtTx();

    const debt = await ensurePurchaseDebt({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      purchaseNumber: "E-26-0001",
      purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
      vendor: "Amazon",
      paymentMethod: "Richard",
      totalGrossCents: 49900,
      tx: state.tx,
    });

    expect(debt).toEqual(expect.objectContaining({
      debtNumber: "SCH-26-0001",
      type: "PURCHASE",
      kind: "KAUF",
      debtorName: "GbR",
      creditorName: "Richard",
      amountCents: 49900,
    }));
    expect(state.debts).toHaveLength(1);
    expect(state.purchaseLinks).toHaveLength(1);
  });

  it("Kauf Firma erzeugt keine Schuld", () => {
    expect(resolvePurchaseDebtCreditor("Firma")).toBeNull();
    expect(purchaseDebtPayload({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      purchaseNumber: "E-26-0001",
      purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
      vendor: "Amazon",
      paymentMethod: "Firma",
      totalGrossCents: 49900,
    })).toBeNull();
  });

  it("Verkauf Richard nutzt VK brutto als Schuld-Basis", async () => {
    const state = createDebtTx();

    const debt = await ensureSaleDebt({
      organizationId: "org-a",
      createdById: "user-a",
      saleId: "sale-a",
      saleNumber: "V-26-0001",
      soldAt: new Date("2026-02-01T00:00:00.000Z"),
      payoutRecipient: "PayPal R",
      saleGrossCents: 11900,
      quantity: 2,
      description: "Verkauf über Inventory-Allocation",
      tx: state.tx,
    });

    expect(resolveSaleDebtDebtor("PayPal R")).toBe("Richard");
    expect(debt).toEqual(expect.objectContaining({
      debtNumber: "SCH-26-0001",
      type: "SALE",
      kind: "VERKAUF",
      debtorName: "Richard",
      creditorName: "GbR",
      amountCents: 11900,
    }));
    expect(state.saleLinks).toHaveLength(1);
  });

  it("wiederholter API-Request erzeugt keine doppelte Purchase-Schuld", async () => {
    const state = createDebtTx();
    const input = {
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      purchaseNumber: "E-26-0001",
      purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
      vendor: "Amazon",
      paymentMethod: "Daniel",
      totalGrossCents: 100000,
      tx: state.tx,
    };

    const first = await ensurePurchaseDebt(input);
    const second = await ensurePurchaseDebt(input);

    expect(first?.id).toBe(second?.id);
    expect(state.debts).toHaveLength(1);
    expect(state.purchaseLinks).toHaveLength(1);
  });

  it("mehrere PurchaseLines bleiben eine Purchase Debt", () => {
    const payload = purchaseDebtPayload({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      purchaseNumber: "E-26-0002",
      purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
      vendor: "Amazon",
      paymentMethod: "Richard",
      totalGrossCents: 2999 + 3999 + 4999,
    });

    expect(payload).toEqual(expect.objectContaining({
      quantity: 1,
      amountCents: 11997,
    }));
  });

  it("nutzt einen konfigurierten privaten Zahlungskonto-Inhaber statt Namenslogik", () => {
    expect(purchaseDebtPayload({
      organizationId: "org-a",
      purchaseId: "purchase-configured",
      purchaseNumber: "E-26-0099",
      purchaseDate: new Date("2026-07-14T00:00:00.000Z"),
      vendor: "Lieferant",
      paymentMethod: "Gesellschafterkonto",
      creditorName: "Konfigurierter Gesellschafter",
      totalGrossCents: 12000,
    })).toEqual(expect.objectContaining({ creditorName: "Konfigurierter Gesellschafter" }));
  });

  it("manuelle Schuld bleibt ohne Ursprungsrelation", async () => {
    const state = createDebtTx();

    await createManualDebt({
      organizationId: "org-a",
      createdById: "user-a",
      tx: state.tx,
      payload: {
        date: new Date("2026-03-01T00:00:00.000Z"),
        description: "Ausgleich",
        type: "MANUAL",
        kind: "SONSTIGES",
        amountCents: 5000,
        debtorName: "Richard",
        creditorName: "Daniel",
      },
    });

    expect(state.debts[0]).toEqual(expect.objectContaining({
      debtNumber: "SCH-26-0001",
      type: "MANUAL",
    }));
    expect(state.purchaseLinks).toHaveLength(0);
    expect(state.saleLinks).toHaveLength(0);
  });

  it("Settlement setzt Status, Bezahltbetrag und Datum", async () => {
    const state = createDebtTx();
    const debt = await createManualDebt({
      organizationId: "org-a",
      createdById: "user-a",
      tx: state.tx,
      payload: {
        date: new Date("2026-03-01T00:00:00.000Z"),
        description: "Ausgleich",
        type: "MANUAL",
        kind: "SONSTIGES",
        amountCents: 5000,
        debtorName: "Richard",
        creditorName: "Daniel",
      },
    });

    const settled = await settleDebt({
      organizationId: "org-a",
      debtId: debt.id,
      status: "SETTLED",
      settledAt: new Date("2026-03-02T00:00:00.000Z"),
      userId: "user-a",
      tx: state.tx,
    });

    expect(settled).toEqual(expect.objectContaining({
      status: "SETTLED",
      paidCents: 5000,
      settledAt: new Date("2026-03-02T00:00:00.000Z"),
    }));
  });

  it("Organization-Trennung verhindert fremdes Settlement", async () => {
    const state = createDebtTx();
    const debt = await createManualDebt({
      organizationId: "org-a",
      createdById: "user-a",
      tx: state.tx,
      payload: {
        date: new Date("2026-03-01T00:00:00.000Z"),
        description: "Ausgleich",
        type: "MANUAL",
        kind: "SONSTIGES",
        amountCents: 5000,
        debtorName: "Richard",
        creditorName: "Daniel",
      },
    });

    await expect(
      settleDebt({
        organizationId: "org-b",
        debtId: debt.id,
        status: "SETTLED",
        userId: "user-b",
        tx: state.tx,
      })
    ).resolves.toBeNull();
    expect(state.debts[0].status).toBe("OPEN");
  });

  it("Sale-Payload bleibt bei Firmenauszahlung leer", () => {
    expect(saleDebtPayload({
      organizationId: "org-a",
      saleId: "sale-a",
      saleNumber: "V-26-0001",
      soldAt: new Date("2026-02-01T00:00:00.000Z"),
      payoutRecipient: "Firma",
      saleGrossCents: 11900,
      quantity: 1,
      description: "Verkauf",
    })).toBeNull();
  });
});
