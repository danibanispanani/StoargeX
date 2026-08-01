import { describe, expect, it, vi } from "vitest";
import {
  getStockMetadataChanges,
  updateInventoryPositionMetadata,
} from "@/lib/stock/stock-metadata-service";

describe("stock metadata", () => {
  it("returns only fields that actually changed", () => {
    expect(getStockMetadataChanges(
      { itemCondition: "NEW", imageUrls: ["https://example.test/old.jpg"] },
      { itemCondition: "USED", imageUrls: ["https://example.test/new.jpg"] }
    )).toEqual({
      before: {
        itemCondition: "NEW",
        imageUrls: ["https://example.test/old.jpg"],
      },
      after: {
        itemCondition: "USED",
        imageUrls: ["https://example.test/new.jpg"],
      },
    });
  });

  it("does not update or audit an unchanged save", async () => {
    const update = vi.fn();
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      inventoryPosition: {
        findFirst: vi.fn().mockResolvedValue({
          id: "position-a",
          itemCondition: "NEW",
          inventoryType: "OWNED",
          ownedLot: { imageUrls: ["https://example.test/image.jpg"] },
        }),
        update,
      },
      ownedStockLot: { update: vi.fn() },
      auditLog: { create: auditCreate },
    };

    const result = await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      itemCondition: "NEW",
      imageUrls: ["https://example.test/image.jpg"],
      tx: tx as never,
    });

    expect(result.changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("updates safe fields and writes before/after values to AuditLog", async () => {
    const positionUpdate = vi.fn();
    const lotUpdate = vi.fn();
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      inventoryPosition: {
        findFirst: vi.fn().mockResolvedValue({
          id: "position-a",
          itemCondition: "NEW",
          inventoryType: "OWNED",
          ownedLot: { imageUrls: [] },
        }),
        update: positionUpdate,
      },
      ownedStockLot: { update: lotUpdate },
      auditLog: { create: auditCreate },
    };

    const result = await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      itemCondition: "OPEN_BOX",
      imageUrls: ["https://example.test/image.jpg"],
      tx: tx as never,
    });

    expect(result.changed).toBe(true);
    expect(positionUpdate).toHaveBeenCalledWith({
      where: { id: "position-a" },
      data: { itemCondition: "OPEN_BOX" },
    });
    expect(lotUpdate).toHaveBeenCalledWith({
      where: { inventoryPositionId: "position-a" },
      data: { imageUrls: ["https://example.test/image.jpg"] },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        userId: "user-a",
        action: "inventory_position.updated",
        entityType: "InventoryPosition",
        entityId: "position-a",
        before: { itemCondition: "NEW", imageUrls: [] },
        after: {
          itemCondition: "OPEN_BOX",
          imageUrls: ["https://example.test/image.jpg"],
        },
      }),
    });
  });

  it("redacts image query parameters in the audit trail", async () => {
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      inventoryPosition: {
        findFirst: vi.fn().mockResolvedValue({
          id: "position-a",
          itemCondition: "NEW",
          inventoryType: "OWNED",
          ownedLot: { imageUrls: ["https://example.test/image.jpg?token=old"] },
        }),
        update: vi.fn(),
      },
      ownedStockLot: { update: vi.fn() },
      auditLog: { create: auditCreate },
    };

    await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      itemCondition: "NEW",
      imageUrls: ["https://example.test/image.jpg?token=new"],
      tx: tx as never,
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: { imageUrls: ["https://example.test/image.jpg?[Parameter ausgeblendet]"] },
        after: { imageUrls: ["https://example.test/image.jpg?[Parameter ausgeblendet]"] },
      }),
    });
  });
});
