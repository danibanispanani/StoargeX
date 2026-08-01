import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  revalidatePath: vi.fn(),
  assertFeatureAccess: vi.fn(),
  inventoryPositionFindFirst: vi.fn(),
  platformFindFirst: vi.fn(),
  platformFindMany: vi.fn(),
  inventoryPositionListingUpsert: vi.fn(),
  inventoryPositionListingDeleteMany: vi.fn(),
  updateInventoryPositionMetadata: vi.fn(),
  updateLegacyStockItemMetadata: vi.fn(),
  inventoryMovementFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
  stockItemFindFirst: vi.fn(),
  selectOptionFindFirst: vi.fn(),
  createOwnedPurchase: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/feature-access", () => ({
  assertFeatureAccess: mocks.assertFeatureAccess,
}));
vi.mock("@/lib/services/owned-purchase-service", () => ({
  createOwnedPurchase: mocks.createOwnedPurchase,
}));
vi.mock("@/lib/stock/stock-metadata-service", () => ({
  updateInventoryPositionMetadata: mocks.updateInventoryPositionMetadata,
  updateLegacyStockItemMetadata: mocks.updateLegacyStockItemMetadata,
}));
import {
  createStockItemAction,
  loadStockHistoryAction,
  toggleInventoryPositionListingAction,
  updateInventoryPositionMetadataAction,
} from "@/lib/actions/stock";

describe("stock actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrg.mockResolvedValue({
      userId: "user-a",
      organization: { id: "org-a" },
      db: {
        inventoryPosition: { findFirst: mocks.inventoryPositionFindFirst },
        inventoryPositionListing: {
          upsert: mocks.inventoryPositionListingUpsert,
          deleteMany: mocks.inventoryPositionListingDeleteMany,
        },
        platform: {
          findFirst: mocks.platformFindFirst,
          findMany: mocks.platformFindMany,
        },
        inventoryMovement: { findMany: mocks.inventoryMovementFindMany },
        auditLog: { findMany: mocks.auditLogFindMany },
        stockItem: { findFirst: mocks.stockItemFindFirst },
        selectOption: { findFirst: mocks.selectOptionFindFirst },
      },
    });
    mocks.inventoryPositionFindFirst.mockResolvedValue({
      id: "position-a",
      inventoryNumber: "L-26-0236",
      inventoryType: "OWNED",
    });
    mocks.platformFindFirst.mockResolvedValue({
      id: "platform-a",
      name: "Kaufland.de",
    });
    mocks.updateInventoryPositionMetadata.mockResolvedValue({
      changed: true,
      metadata: {
        productName: "Produkt neu",
        variant: "Blau",
        size: "L",
        ean: "1234567890123",
        itemCondition: "USED",
        imageUrls: ["https://example.test/image.jpg"],
        location: "Regal B-2",
        notes: "Geprüft",
      },
    });
    mocks.inventoryMovementFindMany.mockResolvedValue([]);
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.selectOptionFindFirst.mockResolvedValue({ id: "location-a" });
    mocks.platformFindMany.mockResolvedValue([]);
    mocks.createOwnedPurchase.mockResolvedValue({
      purchase: { id: "purchase-a" },
      purchaseNumber: "E-26-0001",
      lines: [{ inventoryNumber: "L-26-0001" }],
      debt: null,
    });
  });

  it("returns a readable toast after changing an owned listing", async () => {
    const result = await toggleInventoryPositionListingAction(
      "position-a",
      "platform-a",
      true
    );

    expect(result?.success).toBe("L-26-0236: Kaufland.de gelistet ✓");
  });

  it("passes condition, managed location and image to manual goods receipt", async () => {
    const form = new FormData();
    form.set("purchaseDate", "2026-08-01");
    form.set("supplier", "Lieferant A");
    form.set("productId", "");
    form.set("title", "Produkt A");
    form.set("variant", "");
    form.set("size", "");
    form.set("priceGross", "19,99");
    form.set("paymentMethod", "Firma");
    form.set("quantity", "3");
    form.set("itemCondition", "OPEN_BOX");
    form.set("location", "Regal A-1");
    form.set("imageUrl", "https://example.test/product.jpg");
    form.set("ean", "");
    form.set("notes", "");

    const result = await createStockItemAction(null, form);

    expect(mocks.createOwnedPurchase).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      lines: [expect.objectContaining({
        quantity: 3,
        itemCondition: "OPEN_BOX",
        location: "Regal A-1",
        imageUrls: ["https://example.test/product.jpg"],
      })],
    }));
    expect(result?.success).toContain("Wareneingang E-26-0001");
  });

  it("passes only safe metadata fields and ignores protected form fields", async () => {
    const form = new FormData();
    form.set("itemCondition", "USED");
    form.set("imageUrls", "https://example.test/image.jpg");
    form.set("productName", "Produkt neu");
    form.set("variant", "Blau");
    form.set("size", "L");
    form.set("ean", "1234567890123");
    form.set("location", "Regal B-2");
    form.set("notes", "GeprÃ¼ft");
    form.set("quantityAvailable", "999");
    form.set("purchaseLineId", "foreign-line");
    form.set("inventoryNumber", "changed-number");

    const result = await updateInventoryPositionMetadataAction(
      "position-a",
      null,
      form
    );

    expect(mocks.requireOrg).toHaveBeenLastCalledWith("MEMBER", expect.anything());
    expect(mocks.updateInventoryPositionMetadata).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      productName: "Produkt neu",
      variant: "Blau",
      size: "L",
      ean: "1234567890123",
      itemCondition: "USED",
      imageUrls: ["https://example.test/image.jpg"],
      location: "Regal B-2",
      notes: "GeprÃ¼ft",
      performanceTrace: expect.anything(),
    }));
    expect(result?.success).toMatch(/gespeichert/);
    expect(result?.rowPatch).toEqual(expect.objectContaining({
      id: "position-a",
      source: "owned",
      title: "Produkt neu",
      imageUrl: "https://example.test/image.jpg",
    }));
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/lager");
  });

  it("loads history only after tenant-safe position resolution", async () => {
    mocks.inventoryPositionFindFirst.mockResolvedValueOnce({
      id: "position-a",
      quantityAvailable: 1,
      quantityInspection: 0,
      quantityDefective: 0,
      ownedLot: {
        purchaseLine: { purchase: { purchaseNumber: "E-26-0001" } },
      },
      purchaseReceiptLine: null,
      supplierReturnLines: [],
    });
    const result = await loadStockHistoryAction("owned", "position-a");

    expect(mocks.requireOrg).toHaveBeenLastCalledWith();
    expect(mocks.inventoryPositionFindFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "position-a", organizationId: "org-a" },
      select: expect.objectContaining({ id: true, supplierReturnLines: expect.anything() }),
    }));
    expect(mocks.inventoryMovementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a", inventoryPositionId: "position-a" },
      })
    );
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-a",
          entityType: "InventoryPosition",
          entityId: "position-a",
        }),
      })
    );
    expect(result.data).toEqual({
      ownedDetails: expect.objectContaining({
        purchaseNumber: "E-26-0001",
        returnableQuantity: 1,
      }),
      movements: [],
      auditLogs: [],
    });
  });

  it("does not invalidate the stock page for an unchanged metadata save", async () => {
    mocks.updateInventoryPositionMetadata.mockResolvedValue({
      changed: false,
      metadata: {
        productName: "Produkt",
        variant: null,
        size: null,
        ean: null,
        itemCondition: "NEW",
        imageUrls: [],
        location: null,
        notes: null,
      },
    });
    const form = new FormData();
    form.set("productName", "Produkt");
    form.set("itemCondition", "NEW");

    const result = await updateInventoryPositionMetadataAction("position-a", null, form);

    expect(result?.success).toBe("Keine Änderungen vorhanden.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

});
