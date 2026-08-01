import { describe, expect, it, vi } from "vitest";
import {
  getStockMetadataChanges,
  updateInventoryPositionMetadata,
  updateLegacyStockItemMetadata,
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
          location: "A-1",
          notes: "Notiz",
          product: {
            id: "product-a",
            name: "Produkt",
            variant: "Rot",
            size: "M",
            ean: "1111111111111",
            imageUrls: ["https://example.test/image.jpg"],
          },
          ownedLot: {
            imageUrls: ["https://example.test/image.jpg"],
            ean: "1111111111111",
          },
        }),
        update,
      },
      product: { findFirst: vi.fn(), update: vi.fn() },
      ownedStockLot: { update: vi.fn() },
      auditLog: { create: auditCreate },
    };

    const result = await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      productName: "Produkt",
      variant: "Rot",
      size: "M",
      ean: "1111111111111",
      itemCondition: "NEW",
      imageUrls: ["https://example.test/image.jpg"],
      location: "A-1",
      notes: "Notiz",
      tx: tx as never,
    });

    expect(result.changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("updates safe fields and writes before/after values to AuditLog", async () => {
    const positionUpdate = vi.fn();
    const lotUpdate = vi.fn();
    const productUpdate = vi.fn();
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      inventoryPosition: {
        findFirst: vi.fn().mockResolvedValue({
          id: "position-a",
          itemCondition: "NEW",
          inventoryType: "OWNED",
          location: "A-1",
          notes: "Alt",
          product: {
            id: "product-a",
            name: "Altes Produkt",
            variant: "Rot",
            size: "M",
            ean: "1111111111111",
            imageUrls: [],
          },
          ownedLot: { imageUrls: [], ean: "1111111111111" },
        }),
        update: positionUpdate,
      },
      product: { findFirst: vi.fn().mockResolvedValue(null), update: productUpdate },
      ownedStockLot: { update: lotUpdate },
      auditLog: { create: auditCreate },
    };

    const result = await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      itemCondition: "OPEN_BOX",
      imageUrls: ["https://example.test/image.jpg"],
      productName: "Neues Produkt",
      variant: "Blau",
      size: "L",
      ean: "2222222222222",
      location: "B-2",
      notes: "Neue Notiz",
      tx: tx as never,
    });

    expect(result.changed).toBe(true);
    expect(positionUpdate).toHaveBeenCalledWith({
      where: { id: "position-a" },
      data: {
        itemCondition: "OPEN_BOX",
        location: "B-2",
        notes: "Neue Notiz",
      },
    });
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: "product-a" },
      data: {
        name: "Neues Produkt",
        variant: "Blau",
        size: "L",
        ean: "2222222222222",
        imageUrls: ["https://example.test/image.jpg"],
      },
    });
    expect(lotUpdate).toHaveBeenCalledWith({
      where: { inventoryPositionId: "position-a" },
      data: {
        imageUrls: ["https://example.test/image.jpg"],
        ean: "2222222222222",
      },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        userId: "user-a",
        action: "inventory_position.updated",
        entityType: "InventoryPosition",
        entityId: "position-a",
        before: {
          productName: "Altes Produkt",
          variant: "Rot",
          size: "M",
          ean: "1111111111111",
          itemCondition: "NEW",
          imageUrls: [],
          location: "A-1",
          notes: "Alt",
        },
        after: {
          productName: "Neues Produkt",
          variant: "Blau",
          size: "L",
          ean: "2222222222222",
          itemCondition: "OPEN_BOX",
          imageUrls: ["https://example.test/image.jpg"],
          location: "B-2",
          notes: "Neue Notiz",
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
          location: null,
          notes: null,
          product: {
            id: "product-a",
            name: "Produkt",
            variant: null,
            size: null,
            ean: null,
            imageUrls: ["https://example.test/image.jpg?token=old"],
          },
          ownedLot: {
            imageUrls: ["https://example.test/image.jpg?token=old"],
            ean: null,
          },
        }),
        update: vi.fn(),
      },
      product: { findFirst: vi.fn(), update: vi.fn() },
      ownedStockLot: { update: vi.fn() },
      auditLog: { create: auditCreate },
    };

    await updateInventoryPositionMetadata({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      productName: "Produkt",
      variant: null,
      size: null,
      ean: null,
      itemCondition: "NEW",
      imageUrls: ["https://example.test/image.jpg?token=new"],
      location: null,
      notes: null,
      tx: tx as never,
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: { imageUrls: ["https://example.test/image.jpg?[Parameter ausgeblendet]"] },
        after: { imageUrls: ["https://example.test/image.jpg?[Parameter ausgeblendet]"] },
      }),
    });
  });

  it("updates descriptive fields of a legacy stock position", async () => {
    const update = vi.fn();
    const auditCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      stockItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "legacy-a",
          title: "Alt",
          variant: null,
          size: null,
          ean: null,
          itemCondition: null,
          imageUrls: [],
          location: null,
          notes: null,
        }),
        update,
      },
      auditLog: { create: auditCreate },
    };

    const result = await updateLegacyStockItemMetadata({
      organizationId: "org-a",
      stockItemId: "legacy-a",
      userId: "user-a",
      productName: "Neu",
      variant: "Blau",
      size: "L",
      ean: "1234567890123",
      itemCondition: "USED",
      imageUrls: ["https://example.test/image.jpg"],
      location: "Regal 2",
      notes: "Notiz",
      tx: tx as never,
    });

    expect(result.changed).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "legacy-a" },
      data: {
        title: "Neu",
        variant: "Blau",
        size: "L",
        ean: "1234567890123",
        itemCondition: "USED",
        imageUrls: ["https://example.test/image.jpg"],
        location: "Regal 2",
        notes: "Notiz",
      },
    });
    expect(auditCreate).toHaveBeenCalledOnce();
  });
});
