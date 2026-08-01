import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  revalidatePath: vi.fn(),
  assertFeatureAccess: vi.fn(),
  inventoryPositionFindFirst: vi.fn(),
  platformFindFirst: vi.fn(),
  inventoryPositionListingUpsert: vi.fn(),
  inventoryPositionListingDeleteMany: vi.fn(),
  updateInventoryPositionMetadata: vi.fn(),
  updateLegacyStockItemMetadata: vi.fn(),
  inventoryMovementFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
  stockItemFindFirst: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/feature-access", () => ({
  assertFeatureAccess: mocks.assertFeatureAccess,
}));
vi.mock("@/lib/services/owned-purchase-service", () => ({
  createOwnedPurchase: vi.fn(),
}));
vi.mock("@/lib/stock/stock-metadata-service", () => ({
  updateInventoryPositionMetadata: mocks.updateInventoryPositionMetadata,
  updateLegacyStockItemMetadata: mocks.updateLegacyStockItemMetadata,
}));
import {
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
        platform: { findFirst: mocks.platformFindFirst },
        inventoryMovement: { findMany: mocks.inventoryMovementFindMany },
        auditLog: { findMany: mocks.auditLogFindMany },
        stockItem: { findFirst: mocks.stockItemFindFirst },
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
    mocks.updateInventoryPositionMetadata.mockResolvedValue({ changed: true });
    mocks.inventoryMovementFindMany.mockResolvedValue([]);
    mocks.auditLogFindMany.mockResolvedValue([]);
  });

  it("returns a readable toast after changing an owned listing", async () => {
    const result = await toggleInventoryPositionListingAction(
      "position-a",
      "platform-a",
      true
    );

    expect(result?.success).toBe("L-26-0236: Kaufland.de gelistet ✓");
  });

  it("passes only safe metadata fields and ignores protected form fields", async () => {
    const form = new FormData();
    form.set("itemCondition", "USED");
    form.set("imageUrls", "https://example.test/image.jpg");
    form.set("quantityAvailable", "999");
    form.set("purchaseLineId", "foreign-line");
    form.set("inventoryNumber", "changed-number");

    const result = await updateInventoryPositionMetadataAction(
      "position-a",
      null,
      form
    );

    expect(mocks.requireOrg).toHaveBeenLastCalledWith("MEMBER");
    expect(mocks.updateInventoryPositionMetadata).toHaveBeenCalledWith({
      organizationId: "org-a",
      inventoryPositionId: "position-a",
      userId: "user-a",
      itemCondition: "USED",
      imageUrls: ["https://example.test/image.jpg"],
    });
    expect(result?.success).toMatch(/gespeichert/);
  });

  it("loads history only after tenant-safe position resolution", async () => {
    const result = await loadStockHistoryAction("owned", "position-a");

    expect(mocks.requireOrg).toHaveBeenLastCalledWith();
    expect(mocks.inventoryPositionFindFirst).toHaveBeenLastCalledWith({
      where: { id: "position-a", organizationId: "org-a" },
      select: { id: true },
    });
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
    expect(result.data).toEqual({ movements: [], auditLogs: [] });
  });

  it("does not invalidate the stock page for an unchanged metadata save", async () => {
    mocks.updateInventoryPositionMetadata.mockResolvedValue({ changed: false });
    const form = new FormData();
    form.set("itemCondition", "NEW");

    const result = await updateInventoryPositionMetadataAction("position-a", null, form);

    expect(result?.success).toBe("Keine Änderungen vorhanden.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

});
