import type { InventoryMovement, InventoryPosition, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { cancelInventorySale } from "@/lib/services/sales-service";

interface CancelState {
  saleStatus: "PENDING" | "CANCELLED";
  position: InventoryPosition;
  movements: InventoryMovement[];
  auditLogs: unknown[];
}

class MemoryCancelClient {
  readonly state: CancelState;

  constructor() {
    const now = new Date(Date.UTC(2026, 0, 1));
    this.state = {
      saleStatus: "PENDING",
      position: {
        id: "pos-a",
        organizationId: "org-a",
        productId: "product-a",
        inventoryType: "OWNED",
        inventoryNumber: "L-26-0001",
        quantityReceived: 2,
        quantityAvailable: 0,
        quantityReserved: 0,
        quantityInspection: 0,
        quantityDefective: 0,
        quantitySold: 2,
        active: true,
        itemCondition: null,
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      movements: [
        {
          id: "move-sale",
          organizationId: "org-a",
          inventoryPositionId: "pos-a",
          movementType: "SALE_OUT",
          quantity: 2,
          fromBucket: "AVAILABLE",
          toBucket: null,
          referenceType: "SaleLineAllocation",
          referenceId: "alloc-a",
          referenceAction: "sale_out",
          idempotencyKey: "sale:sale-a:allocation:alloc-a:sale-out",
          comment: null,
          createdById: "user-a",
          createdAt: now,
        },
      ],
      auditLogs: [],
    };
  }

  asPrisma(): Pick<PrismaClient, "$transaction"> {
    return {
      $transaction: async <T>(operation: (tx: MemoryCancelTransaction) => Promise<T>) =>
        operation(new MemoryCancelTransaction(this.state)),
    } as unknown as Pick<PrismaClient, "$transaction">;
  }
}

class MemoryCancelTransaction {
  constructor(private readonly state: CancelState) {}

  async $executeRaw(): Promise<number> {
    return 0;
  }

  sale = {
    findFirst: async () => ({
      id: "sale-a",
      organizationId: "org-a",
      orderNumber: "V-26-0001",
      status: this.state.saleStatus,
      returns: [],
      saleLines: [
        {
          id: "line-a",
          allocations: [
            {
              id: "alloc-a",
              inventoryPositionId: "pos-a",
              quantity: 2,
            },
          ],
        },
      ],
    }),
    update: async () => {
      this.state.saleStatus = "CANCELLED";
      return {
        id: "sale-a",
        organizationId: "org-a",
        orderNumber: "V-26-0001",
        status: "CANCELLED",
      };
    },
  };

  inventoryPosition = {
    findFirst: async () => ({ ...this.state.position }),
    updateMany: async (args: { data: Record<string, { increment?: number; decrement?: number }> }) => {
      for (const [field, operation] of Object.entries(args.data)) {
        const key = field as keyof Pick<
          InventoryPosition,
          | "quantityReceived"
          | "quantityAvailable"
          | "quantityReserved"
          | "quantityInspection"
          | "quantityDefective"
          | "quantitySold"
        >;
        if (operation.increment) this.state.position[key] += operation.increment;
        if (operation.decrement) this.state.position[key] -= operation.decrement;
      }
      return { count: 1 };
    },
  };

  inventoryMovement = {
    findFirst: async (args: { where: { id?: string; referenceId?: string; movementType?: string } }) =>
      this.state.movements.find((movement) => {
        if (args.where.id && movement.id !== args.where.id) return false;
        if (args.where.referenceId && movement.referenceId !== args.where.referenceId) return false;
        if (args.where.movementType && movement.movementType !== args.where.movementType) return false;
        return true;
      }) ?? null,
    findUnique: async (args: {
      where: { organizationId_idempotencyKey: { idempotencyKey: string } };
    }) =>
      this.state.movements.find(
        (movement) =>
          movement.idempotencyKey ===
          args.where.organizationId_idempotencyKey.idempotencyKey
      ) ?? null,
    create: async (args: { data: Omit<InventoryMovement, "id" | "createdAt"> }) => {
      const movement = {
        ...args.data,
        id: `move-${this.state.movements.length + 1}`,
        createdAt: new Date(Date.UTC(2026, 0, this.state.movements.length + 1)),
      } as InventoryMovement;
      this.state.movements.push(movement);
      return movement;
    },
  };

  auditLog = {
    create: async (args: { data: unknown }) => {
      this.state.auditLogs.push(args.data);
      return args.data;
    },
  };
}

describe("sales cancellation service", () => {
  it("Stornierung führt Bestand per Reversal zurück", async () => {
    const client = new MemoryCancelClient();

    const result = await cancelInventorySale({
      organizationId: "org-a",
      saleId: "sale-a",
      createdById: "user-a",
      prisma: client.asPrisma(),
    });

    expect(result.alreadyCancelled).toBe(false);
    expect(client.state.saleStatus).toBe("CANCELLED");
    expect(client.state.position.quantityAvailable).toBe(2);
    expect(client.state.position.quantitySold).toBe(0);
    expect(client.state.movements.map((movement) => movement.movementType)).toEqual([
      "SALE_OUT",
      "REVERSAL",
    ]);
  });

  it("Stornierung ist idempotent", async () => {
    const client = new MemoryCancelClient();

    await cancelInventorySale({
      organizationId: "org-a",
      saleId: "sale-a",
      createdById: "user-a",
      prisma: client.asPrisma(),
    });
    const second = await cancelInventorySale({
      organizationId: "org-a",
      saleId: "sale-a",
      createdById: "user-a",
      prisma: client.asPrisma(),
    });

    expect(second.alreadyCancelled).toBe(true);
    expect(client.state.position.quantityAvailable).toBe(2);
    expect(client.state.position.quantitySold).toBe(0);
    expect(client.state.movements).toHaveLength(2);
  });
});
