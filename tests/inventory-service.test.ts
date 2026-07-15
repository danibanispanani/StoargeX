import {
  InventoryBucket,
  InventoryMovementType,
  type InventoryMovement,
  type InventoryPosition,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getInventoryTimeline,
  markReturnDefective,
  receiveConsignmentStock,
  receiveOwnedStock,
  receiveReturn,
  restockReturn,
  returnOwnedStockToSupplier,
  sell,
} from "@/lib/services/inventory-service";

type QuantityField =
  | "quantityReceived"
  | "quantityAvailable"
  | "quantityReserved"
  | "quantityInspection"
  | "quantityDefective"
  | "quantitySold";

interface FakeState {
  positions: Map<string, InventoryPosition>;
  movements: InventoryMovement[];
  auditLogs: unknown[];
  movementSeq: number;
  failOnMovementCreate: boolean;
}

interface PositionFindArgs {
  where: {
    id?: string;
    organizationId?: string;
  };
  select?: {
    id?: true;
  };
}

interface PositionUpdateManyArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface MovementFindUniqueArgs {
  where: {
    organizationId_idempotencyKey: {
      organizationId: string;
      idempotencyKey: string;
    };
  };
}

interface MovementFindFirstArgs {
  where: {
    id?: string;
    organizationId?: string;
  };
}

interface MovementFindManyArgs {
  where: {
    organizationId: string;
    inventoryPositionId: string;
  };
}

interface MovementCreateArgs {
  data: {
    organizationId: string;
    inventoryPositionId: string;
    movementType: InventoryMovementType;
    quantity: number;
    fromBucket?: InventoryBucket | null;
    toBucket?: InventoryBucket | null;
    referenceType?: string;
    referenceId?: string;
    referenceAction?: string;
    idempotencyKey?: string;
    comment?: string;
    createdById?: string;
  };
}

class MemoryInventoryClient {
  private state: FakeState;

  constructor(initialPositions: InventoryPosition[]) {
    this.state = {
      positions: new Map(initialPositions.map((p) => [p.id, clonePosition(p)])),
      movements: [],
      auditLogs: [],
      movementSeq: 1,
      failOnMovementCreate: false,
    };
  }

  failNextMovementCreate(): void {
    this.state.failOnMovementCreate = true;
  }

  position(id: string): InventoryPosition {
    const position = this.state.positions.get(id);
    if (!position) throw new Error(`Missing test position ${id}`);
    return clonePosition(position);
  }

  movementCount(): number {
    return this.state.movements.length;
  }

  asPrisma(): Pick<PrismaClient, "$transaction"> {
    return {
      $transaction: async <T>(operation: (tx: MemoryTransaction) => Promise<T>) => {
        const snapshot = cloneState(this.state);
        const tx = new MemoryTransaction(snapshot);
        try {
          const result = await operation(tx);
          this.state = snapshot;
          return result;
        } catch (error) {
          throw error;
        }
      },
    } as unknown as Pick<PrismaClient, "$transaction">;
  }
}

class MemoryTransaction {
  constructor(private readonly state: FakeState) {}

  async $executeRaw(): Promise<number> {
    return 0;
  }

  inventoryPosition = {
    findFirst: async (args: PositionFindArgs) => {
      const position = [...this.state.positions.values()].find(
        (p) =>
          (!args.where.id || p.id === args.where.id) &&
          (!args.where.organizationId ||
            p.organizationId === args.where.organizationId)
      );
      if (!position) return null;
      if (args.select?.id) return { id: position.id };
      return clonePosition(position);
    },
    updateMany: async (args: PositionUpdateManyArgs) => {
      const id = String(args.where.id ?? "");
      const organizationId = String(args.where.organizationId ?? "");
      const position = this.state.positions.get(id);
      if (!position || position.organizationId !== organizationId) {
        return { count: 0 };
      }
      if (!guardsPass(position, args.where)) {
        return { count: 0 };
      }
      applyUpdateData(position, args.data);
      position.updatedAt = new Date();
      return { count: 1 };
    },
  };

  inventoryMovement = {
    findUnique: async (args: MovementFindUniqueArgs) => {
      const key = args.where.organizationId_idempotencyKey;
      return (
        this.state.movements.find(
          (m) =>
            m.organizationId === key.organizationId &&
            m.idempotencyKey === key.idempotencyKey
        ) ?? null
      );
    },
    findFirst: async (args: MovementFindFirstArgs) =>
      this.state.movements.find(
        (m) =>
          (!args.where.id || m.id === args.where.id) &&
          (!args.where.organizationId ||
            m.organizationId === args.where.organizationId)
      ) ?? null,
    findMany: async (args: MovementFindManyArgs) =>
      this.state.movements
        .filter(
          (m) =>
            m.organizationId === args.where.organizationId &&
            m.inventoryPositionId === args.where.inventoryPositionId
        )
        .sort(
          (a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime() ||
            a.id.localeCompare(b.id)
        )
        .map(cloneMovement),
    create: async (args: MovementCreateArgs) => {
      if (this.state.failOnMovementCreate) {
        this.state.failOnMovementCreate = false;
        throw new Error("simulated movement insert failure");
      }

      const movement: InventoryMovement = {
        id: `move-${this.state.movementSeq++}`,
        organizationId: args.data.organizationId,
        inventoryPositionId: args.data.inventoryPositionId,
        movementType: args.data.movementType,
        quantity: args.data.quantity,
        fromBucket: args.data.fromBucket ?? null,
        toBucket: args.data.toBucket ?? null,
        referenceType: args.data.referenceType ?? null,
        referenceId: args.data.referenceId ?? null,
        referenceAction: args.data.referenceAction ?? null,
        idempotencyKey: args.data.idempotencyKey ?? null,
        comment: args.data.comment ?? null,
        createdById: args.data.createdById ?? null,
        createdAt: new Date(Date.UTC(2026, 0, this.state.movementSeq)),
      };
      this.state.movements.push(movement);
      return cloneMovement(movement);
    },
  };

  auditLog = {
    create: async (args: { data: unknown }) => {
      this.state.auditLogs.push(args.data);
      return args.data;
    },
  };
}

function makePosition(
  overrides: Partial<InventoryPosition> = {}
): InventoryPosition {
  const now = new Date(Date.UTC(2026, 0, 1));
  return {
    id: "pos-a",
    organizationId: "org-a",
    productId: "product-a",
    inventoryType: "OWNED",
    inventoryNumber: "L-26-0001",
    quantityReceived: 0,
    quantityAvailable: 0,
    quantityReserved: 0,
    quantityInspection: 0,
    quantityDefective: 0,
    quantitySold: 0,
    active: true,
    receivedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
    itemCondition: overrides.itemCondition ?? null,
  };
}

function cloneState(state: FakeState): FakeState {
  return {
    positions: new Map(
      [...state.positions.entries()].map(([id, position]) => [
        id,
        clonePosition(position),
      ])
    ),
    movements: state.movements.map(cloneMovement),
    auditLogs: [...state.auditLogs],
    movementSeq: state.movementSeq,
    failOnMovementCreate: state.failOnMovementCreate,
  };
}

function clonePosition(position: InventoryPosition): InventoryPosition {
  return {
    ...position,
    receivedAt: new Date(position.receivedAt),
    createdAt: new Date(position.createdAt),
    updatedAt: new Date(position.updatedAt),
  };
}

function cloneMovement(movement: InventoryMovement): InventoryMovement {
  return {
    ...movement,
    createdAt: new Date(movement.createdAt),
  };
}

function guardsPass(
  position: InventoryPosition,
  where: Record<string, unknown>
): boolean {
  for (const field of quantityFields()) {
    const guard = where[field];
    if (!isGteGuard(guard)) continue;
    if (position[field] < guard.gte) return false;
  }
  return true;
}

function applyUpdateData(
  position: InventoryPosition,
  data: Record<string, unknown>
): void {
  for (const field of quantityFields()) {
    const operation = data[field];
    if (!isUpdateOperation(operation)) continue;
    if (typeof operation.increment === "number") {
      position[field] += operation.increment;
    }
    if (typeof operation.decrement === "number") {
      position[field] -= operation.decrement;
    }
  }
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

function isGteGuard(value: unknown): value is { gte: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "gte" in value &&
    typeof value.gte === "number"
  );
}

function isUpdateOperation(
  value: unknown
): value is { increment?: number; decrement?: number } {
  return typeof value === "object" && value !== null;
}

function prisma(client: MemoryInventoryClient): Pick<PrismaClient, "$transaction"> {
  return client.asPrisma();
}

describe("inventory service", () => {
  let client: MemoryInventoryClient;

  beforeEach(() => {
    client = new MemoryInventoryClient([makePosition()]);
  });

  it("Test A: bucht Zugang, Verkauf und Retoure konsistent", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 10,
      idempotencyKey: "receipt-10",
      prisma: prisma(client),
    });
    await sell({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 3,
      idempotencyKey: "sale-3",
      prisma: prisma(client),
    });
    await receiveReturn({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      idempotencyKey: "return-2",
      prisma: prisma(client),
    });
    await restockReturn({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 1,
      idempotencyKey: "restock-1",
      prisma: prisma(client),
    });
    await markReturnDefective({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 1,
      idempotencyKey: "defective-1",
      prisma: prisma(client),
    });

    const position = client.position("pos-a");
    expect(position.quantityAvailable).toBe(8);
    expect(position.quantityInspection).toBe(0);
    expect(position.quantityDefective).toBe(1);
    expect(position.quantitySold).toBe(1);

    const timeline = await getInventoryTimeline({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      prisma: prisma(client),
    });
    expect(timeline.map((m) => m.movementType)).toEqual([
      "PURCHASE_RECEIPT",
      "SALE_OUT",
      "RETURN_RECEIPT",
      "RETURN_RESTOCK",
      "RETURN_DEFECTIVE",
    ]);
  });

  it("Test B: Verkauf von mehr als verfügbarer Menge schlägt fehl", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      prisma: prisma(client),
    });

    await expect(
      sell({
        organizationId: "org-a",
        inventoryPositionId: "pos-a",
        quantity: 3,
        prisma: prisma(client),
      })
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });

    expect(client.position("pos-a").quantityAvailable).toBe(2);
    expect(client.movementCount()).toBe(1);
  });

  it("bucht den Wareneingang je Prüfergebnis direkt in den fachlichen Bucket", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      bucket: "INSPECTION",
      idempotencyKey: "receipt-inspection",
      prisma: prisma(client),
    });
    const position = client.position("pos-a");
    expect(position.quantityReceived).toBe(2);
    expect(position.quantityAvailable).toBe(0);
    expect(position.quantityInspection).toBe(2);
  });

  it("Test C: gleicher idempotencyKey wird nicht doppelt angewendet", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 5,
      prisma: prisma(client),
    });

    const first = await sell({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      idempotencyKey: "sale-once",
      prisma: prisma(client),
    });
    const second = await sell({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      idempotencyKey: "sale-once",
      prisma: prisma(client),
    });

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(client.position("pos-a").quantityAvailable).toBe(3);
    expect(client.position("pos-a").quantitySold).toBe(2);
    expect(client.movementCount()).toBe(2);
  });

  it("bucht eine Lieferantenretoure genau einmal aus dem gewählten Bucket", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 5,
      prisma: prisma(client),
    });

    const first = await returnOwnedStockToSupplier({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      sourceBucket: "AVAILABLE",
      idempotencyKey: "supplier-return-line-a",
      prisma: prisma(client),
    });
    const repeated = await returnOwnedStockToSupplier({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 2,
      sourceBucket: "AVAILABLE",
      idempotencyKey: "supplier-return-line-a",
      prisma: prisma(client),
    });

    expect(first.idempotent).toBe(false);
    expect(repeated.idempotent).toBe(true);
    expect(client.position("pos-a").quantityAvailable).toBe(3);
    expect(client.movementCount()).toBe(2);
    expect(repeated.movement.movementType).toBe("SUPPLIER_RETURN_OUT");
  });

  it("Test D: Organisation A kann Position von Organisation B nicht verändern", async () => {
    await expect(
      receiveOwnedStock({
        organizationId: "org-b",
        inventoryPositionId: "pos-a",
        quantity: 1,
        prisma: prisma(client),
      })
    ).rejects.toMatchObject({
      code: "POSITION_NOT_FOUND",
    });

    expect(client.position("pos-a").quantityAvailable).toBe(0);
    expect(client.movementCount()).toBe(0);
  });

  it("Test E: Transaktionsfehler hinterlässt weder Mengenänderung noch Movement", async () => {
    await receiveOwnedStock({
      organizationId: "org-a",
      inventoryPositionId: "pos-a",
      quantity: 5,
      prisma: prisma(client),
    });

    client.failNextMovementCreate();
    await expect(
      sell({
        organizationId: "org-a",
        inventoryPositionId: "pos-a",
        quantity: 2,
        prisma: prisma(client),
      })
    ).rejects.toThrow("simulated movement insert failure");

    expect(client.position("pos-a").quantityAvailable).toBe(5);
    expect(client.position("pos-a").quantitySold).toBe(0);
    expect(client.movementCount()).toBe(1);
  });

  it("reduziert Konsignationsbestand, führt Retouren in Prüfung und markiert Defekte", async () => {
    client = new MemoryInventoryClient([
      makePosition({
        id: "k-pos",
        inventoryType: "CONSIGNMENT",
        inventoryNumber: "K-26-0001",
      }),
    ]);

    await receiveConsignmentStock({
      organizationId: "org-a",
      inventoryPositionId: "k-pos",
      quantity: 20,
      idempotencyKey: "k-receipt-20",
      prisma: prisma(client),
    });
    await sell({
      organizationId: "org-a",
      inventoryPositionId: "k-pos",
      quantity: 3,
      requiredInventoryType: "CONSIGNMENT",
      idempotencyKey: "k-sale-3",
      prisma: prisma(client),
    });
    await receiveReturn({
      organizationId: "org-a",
      inventoryPositionId: "k-pos",
      quantity: 1,
      requiredInventoryType: "CONSIGNMENT",
      idempotencyKey: "k-return-1",
      prisma: prisma(client),
    });
    await markReturnDefective({
      organizationId: "org-a",
      inventoryPositionId: "k-pos",
      quantity: 1,
      requiredInventoryType: "CONSIGNMENT",
      idempotencyKey: "k-defective-1",
      prisma: prisma(client),
    });

    const position = client.position("k-pos");
    expect(position.quantityReceived).toBe(21);
    expect(position.quantityAvailable).toBe(17);
    expect(position.quantitySold).toBe(2);
    expect(position.quantityInspection).toBe(0);
    expect(position.quantityDefective).toBe(1);
  });
});
