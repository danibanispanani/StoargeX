import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowMocks = vi.hoisted(() => ({
  returnOwnedStockToSupplier: vi.fn(),
  reserveDocumentNumber: vi.fn(),
}));

vi.mock("@/lib/services/inventory-service", () => ({
  returnOwnedStockToSupplier: workflowMocks.returnOwnedStockToSupplier,
}));
vi.mock("@/lib/services/document-number-service", () => ({
  reserveDocumentNumber: workflowMocks.reserveDocumentNumber,
}));
import {
  SupplierReturnDomainError,
  assertSupplierReturnTransition,
  classifySupplierRefund,
  createSupplierReturn,
  dispatchSupplierReturn,
  getSupplierReturnDeadlineState,
  planSupplierReturnLinesFromSnapshots,
  type SupplierReturnInventorySnapshot,
} from "@/lib/services/supplier-return-service";

function snapshot(
  overrides: Partial<SupplierReturnInventorySnapshot> = {}
): SupplierReturnInventorySnapshot {
  return {
    organizationId: "org-a",
    purchaseId: "purchase-a",
    purchaseLineId: "purchase-line-a",
    inventoryPositionId: "position-a",
    inventoryType: "OWNED",
    quantities: {
      AVAILABLE: 4,
      RESERVED: 1,
      INSPECTION: 0,
      DEFECTIVE: 2,
    },
    unitPriceNetCents: 2_500,
    ...overrides,
  };
}

describe("supplier return line planning", () => {
  it("plans a partial quantity against its selected bucket", () => {
    const [line] = planSupplierReturnLinesFromSnapshots({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      selections: [
        {
          purchaseLineId: "purchase-line-a",
          inventoryPositionId: "position-a",
          sourceBucket: "AVAILABLE",
          quantity: 2,
          reason: "Falsche Variante",
        },
      ],
      snapshots: [snapshot()],
    });

    expect(line.quantity).toBe(2);
    expect(line.sourceBucket).toBe("AVAILABLE");
    expect(line.boundCapitalCents).toBe(5_000);
  });

  it("plans the complete currently returnable available quantity", () => {
    const [line] = planSupplierReturnLinesFromSnapshots({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      selections: [{
        purchaseLineId: "purchase-line-a",
        inventoryPositionId: "position-a",
        sourceBucket: "AVAILABLE",
        quantity: 3,
      }],
      snapshots: [snapshot({
        plannedQuantities: { AVAILABLE: 1 },
      })],
    });

    expect(line.quantity).toBe(3);
  });

  it("reserves quantities already used by active supplier-return plans", () => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [{
          purchaseLineId: "purchase-line-a",
          inventoryPositionId: "position-a",
          sourceBucket: "AVAILABLE",
          quantity: 4,
        }],
        snapshots: [snapshot({
          plannedQuantities: { AVAILABLE: 1 },
        })],
      })
    ).toThrow(/nur 3/);
  });

  it.each([0, -1, 1.5])("rejects invalid quantity %s", (quantity) => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [{
          purchaseLineId: "purchase-line-a",
          inventoryPositionId: "position-a",
          sourceBucket: "AVAILABLE",
          quantity,
        }],
        snapshots: [snapshot()],
      })
    ).toThrow(/Menge/);
  });

  it("rejects quantities above the selected bucket", () => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "DEFECTIVE",
            quantity: 3,
          },
        ],
        snapshots: [snapshot()],
      })
    ).toThrow(/nur 2/);
  });

  it("rejects consignment positions and cross-tenant snapshots", () => {
    const selection = {
      purchaseLineId: "purchase-line-a",
      inventoryPositionId: "position-a",
      sourceBucket: "AVAILABLE" as const,
      quantity: 1,
    };

    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [selection],
        snapshots: [snapshot({ inventoryType: "CONSIGNMENT" })],
      })
    ).toThrow(/Eigenbestand/);

    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [selection],
        snapshots: [snapshot({ organizationId: "org-b" })],
      })
    ).toThrow(/Organisation/);
  });

  it("rejects the same position bucket twice", () => {
    expect(() =>
      planSupplierReturnLinesFromSnapshots({
        organizationId: "org-a",
        purchaseId: "purchase-a",
        selections: [
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "AVAILABLE",
            quantity: 1,
          },
          {
            purchaseLineId: "purchase-line-a",
            inventoryPositionId: "position-a",
            sourceBucket: "AVAILABLE",
            quantity: 1,
          },
        ],
        snapshots: [snapshot()],
      })
    ).toThrow(/doppelt/);
  });
});

describe("supplier return workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowMocks.reserveDocumentNumber.mockResolvedValue({ display: "LR-26-0001" });
    workflowMocks.returnOwnedStockToSupplier.mockResolvedValue({
      movement: { id: "movement-a" },
    });
  });

  it("returns an already planned return for a repeated idempotency key", async () => {
    const existing = { id: "return-a", returnNumber: "LR-26-0001" };
    const purchaseFindFirst = vi.fn();
    const tx = {
      supplierReturn: { findFirst: vi.fn().mockResolvedValue(existing) },
      purchase: { findFirst: purchaseFindFirst },
    };

    const result = await createSupplierReturn({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      requestedAt: new Date("2026-08-01T10:00:00.000Z"),
      idempotencyKey: "0f29d224-65cb-4d17-89e2-a0ff5de318aa",
      selections: [{
        purchaseLineId: "purchase-line-a",
        inventoryPositionId: "position-a",
        sourceBucket: "AVAILABLE",
        quantity: 1,
      }],
      tx: tx as never,
    });

    expect(result).toBe(existing);
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("creates a draft with a line without booking stock", async () => {
    const created = { id: "return-a", returnNumber: "LR-26-0001", status: "DRAFT" };
    const create = vi.fn().mockResolvedValue(created);
    const tx = createPlanningTransaction(create);

    const result = await createSupplierReturn({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      requestedAt: new Date("2026-08-01T10:00:00.000Z"),
      selections: [{
        purchaseLineId: "purchase-line-a",
        inventoryPositionId: "position-a",
        sourceBucket: "AVAILABLE",
        quantity: 3,
      }],
      tx: tx as never,
    });

    expect(result).toBe(created);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "DRAFT",
        returnNumber: "LR-26-0001",
        lines: { create: [expect.objectContaining({
          inventoryPositionId: "position-a",
          sourceBucket: "AVAILABLE",
          quantity: 3,
        })] },
      }),
    });
    expect(workflowMocks.returnOwnedStockToSupplier).not.toHaveBeenCalled();
  });

  it("books dispatch exactly once and links the outbound movement", async () => {
    let dispatched = false;
    const lineUpdate = vi.fn().mockImplementation(async () => {
      dispatched = true;
      return { id: "return-line-a" };
    });
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      supplierReturn: {
        findFirst: vi.fn().mockImplementation(async (args: { include?: unknown }) => {
          if (args.include) {
            return {
              id: "return-a",
              organizationId: "org-a",
              returnNumber: "LR-26-0001",
              status: dispatched ? "DISPATCHED" : "APPROVED",
              carrier: null,
              trackingNumber: null,
              lines: [{
                id: "return-line-a",
                inventoryPositionId: "position-a",
                sourceBucket: "AVAILABLE",
                quantity: 3,
                outboundMovementId: dispatched ? "movement-a" : null,
              }],
            };
          }
          return { id: "return-a", status: "DISPATCHED" };
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      supplierReturnLine: { update: lineUpdate },
      auditLog: { create: auditCreate },
    };

    await dispatchSupplierReturn({
      organizationId: "org-a",
      supplierReturnId: "return-a",
      createdById: "user-a",
      tx: tx as never,
    });
    await dispatchSupplierReturn({
      organizationId: "org-a",
      supplierReturnId: "return-a",
      createdById: "user-a",
      tx: tx as never,
    });

    expect(workflowMocks.returnOwnedStockToSupplier).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(workflowMocks.returnOwnedStockToSupplier).toHaveBeenCalledWith(
      expect.objectContaining({
        inventoryPositionId: "position-a",
        quantity: 3,
        sourceBucket: "AVAILABLE",
        idempotencyKey: "supplier-return:return-a:line:return-line-a:dispatch",
      })
    );
    expect(lineUpdate).toHaveBeenCalledOnce();
    expect(lineUpdate).toHaveBeenCalledWith({
      where: { id: "return-line-a" },
      data: { outboundMovementId: "movement-a" },
    });
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("recovers a concurrent unique-key create as idempotent success", async () => {
    const uniqueError = Object.assign(new Error("unique"), { code: "P2002" });
    const firstTx = createPlanningTransaction(vi.fn().mockRejectedValue(uniqueError));
    const existing = { id: "return-a", returnNumber: "LR-26-0001" };
    const secondTx = {
      $executeRaw: vi.fn(),
      supplierReturn: { findFirst: vi.fn().mockResolvedValue(existing) },
    };
    let transactionNumber = 0;
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: never) => Promise<unknown>) => {
        transactionNumber += 1;
        return operation((transactionNumber === 1 ? firstTx : secondTx) as never);
      }),
    };

    const result = await createSupplierReturn({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      idempotencyKey: "0f29d224-65cb-4d17-89e2-a0ff5de318aa",
      requestedAt: new Date("2026-08-01T10:00:00.000Z"),
      selections: [{
        purchaseLineId: "purchase-line-a",
        inventoryPositionId: "position-a",
        sourceBucket: "AVAILABLE",
        quantity: 1,
      }],
      prisma: prisma as never,
    });

    expect(result).toBe(existing);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(secondTx.supplierReturn.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-a",
        idempotencyKey: "0f29d224-65cb-4d17-89e2-a0ff5de318aa",
      },
    });
  });

  it("permits the operational path and rejection before dispatch", () => {
    expect(() => assertSupplierReturnTransition("DRAFT", "REQUESTED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("REQUESTED", "APPROVED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("APPROVED", "DISPATCHED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("DISPATCHED", "ARRIVED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("DISPATCHED", "PARTIALLY_REFUNDED")).not.toThrow();
    expect(() => assertSupplierReturnTransition("REQUESTED", "REJECTED")).not.toThrow();
  });

  it("blocks completion before shipment and terminal-state changes", () => {
    expect(() => assertSupplierReturnTransition("DRAFT", "COMPLETED")).toThrow(
      SupplierReturnDomainError
    );
    expect(() => assertSupplierReturnTransition("COMPLETED", "DISPATCHED")).toThrow(
      /Statuswechsel/
    );
  });

  it("classifies open, partial, and full refunds without rounding ambiguity", () => {
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 0 })).toBe(
      "REFUND_PENDING"
    );
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 4_000 })).toBe(
      "PARTIALLY_REFUNDED"
    );
    expect(classifySupplierRefund({ expectedCents: 10_000, actualCents: 10_000 })).toBe(
      "REFUNDED"
    );
  });

  it("classifies deadlines by calendar day", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(getSupplierReturnDeadlineState(new Date("2026-07-14T23:00:00.000Z"), now)).toBe(
      "OVERDUE"
    );
    expect(getSupplierReturnDeadlineState(new Date("2026-07-17T23:00:00.000Z"), now)).toBe(
      "DUE_SOON"
    );
    expect(getSupplierReturnDeadlineState(new Date("2026-08-01T00:00:00.000Z"), now)).toBe(
      "ON_TRACK"
    );
  });
});

function createPlanningTransaction(create: ReturnType<typeof vi.fn>) {
  return {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    supplierReturn: {
      findFirst: vi.fn().mockResolvedValue(null),
      create,
    },
    supplierReturnLine: { findMany: vi.fn().mockResolvedValue([]) },
    purchase: {
      findFirst: vi.fn().mockResolvedValue({
        id: "purchase-a",
        organizationId: "org-a",
        purchaseNumber: "E-26-0001",
        businessPartnerId: "partner-a",
        businessPartner: { displayName: "Lieferant A" },
        vendor: "Lieferant A",
        returnDeadline: null,
        lines: [{
          id: "purchase-line-a",
          unitPriceNet: 25,
          ownedLots: [{
            organizationId: "org-a",
            inventoryPositionId: "position-a",
            inventoryPosition: {
              inventoryType: "OWNED",
              quantityAvailable: 4,
              quantityReserved: 0,
              quantityInspection: 0,
              quantityDefective: 0,
            },
          }],
        }],
      }),
    },
    auditLog: { create: vi.fn() },
  };
}
