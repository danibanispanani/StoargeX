import type {
  InventoryMovement,
  InventoryPosition,
  PrismaClient,
  PurchaseShippingStatus,
  PurchaseStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  cancelPurchase,
  cancelPurchaseReceipt,
  cancelPurchaseReceiptLineQuantity,
} from "@/lib/services/owned-purchase-service";

interface ReceiptLineState {
  id: string;
  purchaseLineId: string;
  inventoryPositionId: string;
  quantity: number;
  inboundMovementId: string;
  cancelledQuantity: number;
}

interface ReceiptState {
  id: string;
  purchaseId: string;
  receivedAt: Date;
  cancelledAt: Date | null;
  lines: ReceiptLineState[];
}

interface PurchaseState {
  id: string;
  organizationId: string;
  purchaseNumber: string;
  purchaseStatus: PurchaseStatus;
  shippingStatus: PurchaseShippingStatus;
  trackingNumber: string | null;
  receivedAt: Date | null;
  orderedQuantity: number;
}

interface CancellationState {
  purchase: PurchaseState;
  receipts: ReceiptState[];
  positions: InventoryPosition[];
  movements: InventoryMovement[];
  auditLogs: unknown[];
}

class MemoryPurchaseCancellationClient {
  private state: CancellationState;

  constructor(receiptQuantities: number[]) {
    const receivedAt = new Date("2026-07-20T10:00:00.000Z");
    this.state = {
      purchase: {
        id: "purchase-a",
        organizationId: "org-a",
        purchaseNumber: "E-26-0001",
        purchaseStatus: "RECEIVED",
        shippingStatus: "DELIVERED",
        trackingNumber: null,
        receivedAt,
        orderedQuantity: receiptQuantities.reduce((sum, quantity) => sum + quantity, 0),
      },
      receipts: receiptQuantities.map((quantity, index) => ({
        id: `receipt-${index + 1}`,
        purchaseId: "purchase-a",
        receivedAt: new Date(receivedAt.getTime() + index * 86_400_000),
        cancelledAt: null,
        lines: [{
          id: `receipt-line-${index + 1}`,
          purchaseLineId: "purchase-line-a",
          inventoryPositionId: `position-${index + 1}`,
          quantity,
          inboundMovementId: `inbound-${index + 1}`,
          cancelledQuantity: 0,
        }],
      })),
      positions: receiptQuantities.map((quantity, index) =>
        makePosition(`position-${index + 1}`, quantity, receivedAt)
      ),
      movements: receiptQuantities.map((quantity, index) => ({
        id: `inbound-${index + 1}`,
        organizationId: "org-a",
        inventoryPositionId: `position-${index + 1}`,
        movementType: "PURCHASE_RECEIPT",
        quantity,
        fromBucket: null,
        toBucket: "AVAILABLE",
        referenceType: "PurchaseReceipt",
        referenceId: `receipt-${index + 1}`,
        referenceAction: "purchase_receipt",
        idempotencyKey: `receipt-${index + 1}:inbound`,
        comment: null,
        createdById: "user-a",
        createdAt: receivedAt,
      })),
      auditLogs: [],
    };
  }

  consume(receiptIndex: number, quantity: number): void {
    const position = this.state.positions[receiptIndex];
    position.quantityAvailable -= quantity;
    position.quantitySold += quantity;
  }

  purchase(): PurchaseState {
    return { ...this.state.purchase };
  }

  receipt(index: number): ReceiptState {
    return cloneReceipt(this.state.receipts[index]);
  }

  position(index: number): InventoryPosition {
    return { ...this.state.positions[index] };
  }

  activeReceivedQuantity(): number {
    return this.state.receipts
      .filter((receipt) => !receipt.cancelledAt)
      .flatMap((receipt) => receipt.lines)
      .reduce((sum, line) => sum + line.quantity - line.cancelledQuantity, 0);
  }

  movementTypes(): string[] {
    return this.state.movements.map((movement) => movement.movementType);
  }

  asPrisma(): Pick<PrismaClient, "$transaction"> {
    return {
      $transaction: async <T>(operation: (tx: MemoryPurchaseCancellationTransaction) => Promise<T>) => {
        const snapshot = cloneState(this.state);
        const result = await operation(new MemoryPurchaseCancellationTransaction(snapshot));
        this.state = snapshot;
        return result;
      },
    } as unknown as Pick<PrismaClient, "$transaction">;
  }
}

class MemoryPurchaseCancellationTransaction {
  constructor(private readonly state: CancellationState) {}

  async $executeRaw(): Promise<number> {
    return 0;
  }

  purchaseReceipt = {
    findFirst: async (args: { where: { id: string; organizationId: string } }) => {
      if (args.where.organizationId !== this.state.purchase.organizationId) return null;
      const receipt = this.state.receipts.find((item) => item.id === args.where.id);
      if (!receipt) return null;
      return {
        ...cloneReceipt(receipt),
        lines: receipt.lines.map((line) => ({
          ...line,
          inboundMovement: this.state.movements.find(
            (movement) => movement.id === line.inboundMovementId
          ),
        })),
        purchase: this.purchaseWithReceiptLines(),
      };
    },
    update: async (args: { where: { id: string }; data: { cancelledAt: Date } }) => {
      const receipt = this.state.receipts.find((item) => item.id === args.where.id);
      if (!receipt) throw new Error("missing receipt");
      receipt.cancelledAt = args.data.cancelledAt;
      return cloneReceipt(receipt);
    },
  };

  purchaseReceiptLine = {
    findFirst: async (args: {
      where: { inventoryPositionId: string; organizationId: string };
    }) => {
      if (args.where.organizationId !== this.state.purchase.organizationId) return null;
      for (const receipt of this.state.receipts) {
        const line = receipt.lines.find(
          (item) => item.inventoryPositionId === args.where.inventoryPositionId
        );
        if (!line) continue;
        return {
          ...line,
          inboundMovement: this.state.movements.find(
            (movement) => movement.id === line.inboundMovementId
          ),
          purchaseReceipt: {
            ...cloneReceipt(receipt),
            purchase: this.purchaseWithReceiptLines(),
          },
        };
      }
      return null;
    },
    update: async (args: {
      where: { id: string };
      data: { cancelledQuantity: number };
    }) => {
      const line = this.state.receipts
        .flatMap((receipt) => receipt.lines)
        .find((item) => item.id === args.where.id);
      if (!line) throw new Error("missing receipt line");
      line.cancelledQuantity = args.data.cancelledQuantity;
      return { ...line };
    },
  };

  purchase = {
    findFirst: async (args: { where: { id: string; organizationId: string } }) => {
      if (
        args.where.id !== this.state.purchase.id ||
        args.where.organizationId !== this.state.purchase.organizationId
      ) return null;
      return {
        ...this.purchaseWithReceiptLines(),
        receipts: this.state.receipts
          .filter((receipt) => !receipt.cancelledAt)
          .map((receipt) => ({
            ...cloneReceipt(receipt),
            lines: receipt.lines.map((line) => ({
              ...line,
              inboundMovement: this.state.movements.find(
                (movement) => movement.id === line.inboundMovementId
              ),
            })),
          })),
        debtLinks: [],
      };
    },
    update: async (args: {
      where: { id: string };
      data: Partial<Pick<PurchaseState, "purchaseStatus" | "shippingStatus" | "receivedAt">>;
    }) => {
      if (args.where.id !== this.state.purchase.id) throw new Error("missing purchase");
      Object.assign(this.state.purchase, args.data);
      return { ...this.state.purchase };
    },
  };

  inventoryPosition = {
    findFirst: async (args: { where: { id: string; organizationId: string } }) =>
      this.state.positions.find(
        (position) =>
          position.id === args.where.id &&
          position.organizationId === args.where.organizationId
      ) ?? null,
    updateMany: async (args: {
      where: Record<string, unknown>;
      data: Record<string, { increment?: number; decrement?: number }>;
    }) => {
      const position = this.state.positions.find(
        (item) =>
          item.id === args.where.id &&
          item.organizationId === args.where.organizationId
      );
      if (!position || !quantityGuardsPass(position, args.where)) return { count: 0 };
      for (const [field, operation] of Object.entries(args.data)) {
        const key = field as QuantityField;
        if (operation.increment) position[key] += operation.increment;
        if (operation.decrement) position[key] -= operation.decrement;
      }
      return { count: 1 };
    },
  };

  inventoryMovement = {
    findFirst: async (args: { where: { id?: string; organizationId?: string } }) =>
      this.state.movements.find(
        (movement) =>
          (!args.where.id || movement.id === args.where.id) &&
          (!args.where.organizationId || movement.organizationId === args.where.organizationId)
      ) ?? null,
    findUnique: async (args: {
      where: { organizationId_idempotencyKey: { organizationId: string; idempotencyKey: string } };
    }) => {
      const key = args.where.organizationId_idempotencyKey;
      return this.state.movements.find(
        (movement) =>
          movement.organizationId === key.organizationId &&
          movement.idempotencyKey === key.idempotencyKey
      ) ?? null;
    },
    findMany: async (args: {
      where: {
        organizationId: string;
        movementType: string;
        referenceType: string;
        referenceId: string;
      };
    }) => this.state.movements.filter(
      (movement) =>
        movement.organizationId === args.where.organizationId
        && movement.movementType === args.where.movementType
        && movement.referenceType === args.where.referenceType
        && movement.referenceId === args.where.referenceId
    ).map((movement) => ({ quantity: movement.quantity })),
    create: async (args: { data: Omit<InventoryMovement, "id" | "createdAt"> }) => {
      const movement = {
        ...args.data,
        id: `movement-${this.state.movements.length + 1}`,
        createdAt: new Date("2026-07-31T12:00:00.000Z"),
      } as InventoryMovement;
      this.state.movements.push(movement);
      return movement;
    },
  };

  debt = {
    update: async () => {
      throw new Error("debt update is not expected in this test");
    },
  };

  auditLog = {
    create: async (args: { data: unknown }) => {
      this.state.auditLogs.push(args.data);
      return args.data;
    },
  };

  private purchaseWithReceiptLines() {
    return {
      ...this.state.purchase,
      lines: [{
        id: "purchase-line-a",
        quantity: this.state.purchase.orderedQuantity,
        receiptLines: this.state.receipts.flatMap((receipt) =>
          receipt.lines.map((line) => ({
            id: line.id,
            quantity: line.quantity,
            cancelledQuantity: line.cancelledQuantity,
            inventoryPositionId: line.inventoryPositionId,
            purchaseReceipt: {
              id: receipt.id,
              cancelledAt: receipt.cancelledAt,
              receivedAt: receipt.receivedAt,
            },
          }))
        ),
        ownedLots: [],
      }],
    };
  }
}

type QuantityField =
  | "quantityReceived"
  | "quantityAvailable"
  | "quantityReserved"
  | "quantityInspection"
  | "quantityDefective"
  | "quantitySold";

function makePosition(id: string, quantity: number, receivedAt: Date): InventoryPosition {
  return {
    id,
    organizationId: "org-a",
    productId: "product-a",
    inventoryType: "OWNED",
    inventoryNumber: `L-${id}`,
    itemCondition: null,
    location: null,
    notes: null,
    quantityReceived: quantity,
    quantityAvailable: quantity,
    quantityReserved: 0,
    quantityInspection: 0,
    quantityDefective: 0,
    quantitySold: 0,
    active: true,
    receivedAt,
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };
}

function quantityGuardsPass(
  position: InventoryPosition,
  where: Record<string, unknown>
): boolean {
  for (const field of quantityFields()) {
    const guard = where[field];
    if (
      typeof guard === "object" &&
      guard !== null &&
      "gte" in guard &&
      typeof guard.gte === "number" &&
      position[field] < guard.gte
    ) return false;
  }
  return true;
}

function quantityFields(): QuantityField[] {
  return [
    "quantityReceived",
    "quantityAvailable",
    "quantityReserved",
    "quantityInspection",
    "quantityDefective",
    "quantitySold",
  ];
}

function cloneReceipt(receipt: ReceiptState): ReceiptState {
  return {
    ...receipt,
    receivedAt: new Date(receipt.receivedAt),
    cancelledAt: receipt.cancelledAt ? new Date(receipt.cancelledAt) : null,
    lines: receipt.lines.map((line) => ({ ...line })),
  };
}

function cloneState(state: CancellationState): CancellationState {
  return {
    purchase: {
      ...state.purchase,
      receivedAt: state.purchase.receivedAt ? new Date(state.purchase.receivedAt) : null,
    },
    receipts: state.receipts.map(cloneReceipt),
    positions: state.positions.map((position) => ({
      ...position,
      receivedAt: new Date(position.receivedAt),
      createdAt: new Date(position.createdAt),
      updatedAt: new Date(position.updatedAt),
    })),
    movements: state.movements.map((movement) => ({
      ...movement,
      createdAt: new Date(movement.createdAt),
    })),
    auditLogs: [...state.auditLogs],
  };
}

describe("purchase cancellation service", () => {
  it("storniert eine frei gewählte Teilmenge und hält die Restmenge aktiv", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);

    const result = await cancelPurchaseReceiptLineQuantity({
      organizationId: "org-a",
      createdById: "user-a",
      inventoryPositionId: "position-1",
      quantity: 2,
      idempotencyKey: "position-1:cancel:2:first",
      prisma: client.asPrisma(),
    });

    expect(result).toEqual(expect.objectContaining({
      cancelledQuantity: 2,
      remainingQuantity: 3,
      idempotent: false,
    }));
    expect(client.position(0)).toEqual(expect.objectContaining({
      quantityReceived: 3,
      quantityAvailable: 3,
    }));
    expect(client.receipt(0).lines[0].cancelledQuantity).toBe(2);
    expect(client.purchase()).toEqual(expect.objectContaining({
      purchaseStatus: "PARTIALLY_RECEIVED",
      shippingStatus: "PARTIALLY_RECEIVED",
    }));
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT", "REVERSAL"]);
  });

  it("bucht eine wiederholte Teilstornierung nicht doppelt", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);
    const input = {
      organizationId: "org-a",
      createdById: "user-a",
      inventoryPositionId: "position-1",
      quantity: 2,
      idempotencyKey: "position-1:cancel:2:repeat",
      prisma: client.asPrisma(),
    };

    await cancelPurchaseReceiptLineQuantity(input);
    const repeated = await cancelPurchaseReceiptLineQuantity(input);

    expect(repeated.idempotent).toBe(true);
    expect(repeated.remainingQuantity).toBe(3);
    expect(client.position(0).quantityAvailable).toBe(3);
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT", "REVERSAL"]);
  });

  it("weist eine Teilstornierung oberhalb der noch gebuchten Menge ab", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);

    await expect(cancelPurchaseReceiptLineQuantity({
      organizationId: "org-a",
      createdById: "user-a",
      inventoryPositionId: "position-1",
      quantity: 6,
      idempotencyKey: "position-1:cancel:too-many",
      prisma: client.asPrisma(),
    })).rejects.toThrow("höchstens noch 5 Stück");

    expect(client.position(0).quantityAvailable).toBe(5);
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT"]);
  });

  it("storniert einen Wareneingang, reversiert Bestand und Ã¶ffnet die Bestellmenge wieder", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);

    const result = await cancelPurchaseReceipt({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseReceiptId: "receipt-1",
      prisma: client.asPrisma(),
    });

    expect(result.alreadyCancelled).toBe(false);
    expect(client.position(0)).toEqual(expect.objectContaining({
      quantityReceived: 0,
      quantityAvailable: 0,
    }));
    expect(client.activeReceivedQuantity()).toBe(0);
    expect(client.purchase()).toEqual(expect.objectContaining({
      orderedQuantity: 5,
      purchaseStatus: "ORDERED",
      shippingStatus: "NOT_SHIPPED",
    }));
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT", "REVERSAL"]);
  });

  it("behandelt wiederholtes Stornieren desselben Wareneingangs idempotent", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);
    const input = {
      organizationId: "org-a",
      createdById: "user-a",
      purchaseReceiptId: "receipt-1",
      prisma: client.asPrisma(),
    };

    await cancelPurchaseReceipt(input);
    const repeated = await cancelPurchaseReceipt(input);

    expect(repeated.alreadyCancelled).toBe(true);
    expect(client.position(0).quantityReceived).toBe(0);
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT", "REVERSAL"]);
  });

  it("storniert eine ganze Bestellung und reversiert alle aktiven WareneingÃ¤nge", async () => {
    const client = new MemoryPurchaseCancellationClient([2, 3]);

    const result = await cancelPurchase({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseId: "purchase-a",
      prisma: client.asPrisma(),
    });

    expect(result.alreadyCancelled).toBe(false);
    expect(client.purchase().purchaseStatus).toBe("CANCELLED");
    expect(client.receipt(0).cancelledAt).toBeInstanceOf(Date);
    expect(client.receipt(1).cancelledAt).toBeInstanceOf(Date);
    expect(client.position(0).quantityReceived).toBe(0);
    expect(client.position(1).quantityReceived).toBe(0);
    expect(client.movementTypes()).toEqual([
      "PURCHASE_RECEIPT",
      "PURCHASE_RECEIPT",
      "REVERSAL",
      "REVERSAL",
    ]);
  });

  it("blockiert die Stornierung, wenn Bestand aus dem Wareneingang verbraucht wurde", async () => {
    const client = new MemoryPurchaseCancellationClient([5]);
    client.consume(0, 1);

    await expect(cancelPurchaseReceipt({
      organizationId: "org-a",
      createdById: "user-a",
      purchaseReceiptId: "receipt-1",
      prisma: client.asPrisma(),
    })).rejects.toThrow("bereits verkauft, reserviert oder in einen anderen Bestand verschoben");

    expect(client.receipt(0).cancelledAt).toBeNull();
    expect(client.purchase().purchaseStatus).toBe("RECEIVED");
    expect(client.position(0)).toEqual(expect.objectContaining({
      quantityReceived: 5,
      quantityAvailable: 4,
      quantitySold: 1,
    }));
    expect(client.movementTypes()).toEqual(["PURCHASE_RECEIPT"]);
  });
});
