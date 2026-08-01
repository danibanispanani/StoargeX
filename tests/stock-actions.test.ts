import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  revalidatePath: vi.fn(),
  adjust: vi.fn(),
  assertFeatureAccess: vi.fn(),
  inventoryPositionFindFirst: vi.fn(),
  platformFindFirst: vi.fn(),
  inventoryPositionListingUpsert: vi.fn(),
  inventoryPositionListingDeleteMany: vi.fn(),
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
vi.mock("@/lib/services/inventory-service", () => ({ adjust: mocks.adjust }));

import {
  adjustOwnedInventoryQuantityAction,
  toggleInventoryPositionListingAction,
} from "@/lib/actions/stock";

function correctionForm() {
  const form = new FormData();
  form.set("direction", "IN");
  form.set("bucket", "AVAILABLE");
  form.set("quantity", "2");
  form.set("comment", "Inventurdifferenz");
  return form;
}

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
      },
    });
    mocks.adjust.mockResolvedValue({
      position: { inventoryNumber: "L-26-0236" },
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
  });

  it("returns a readable toast after changing an owned listing", async () => {
    const result = await toggleInventoryPositionListingAction(
      "position-a",
      "platform-a",
      true
    );

    expect(result?.success).toBe("L-26-0236: Kaufland.de gelistet ✓");
  });

  it("creates a unique idempotency key for every manual correction", async () => {
    const first = await adjustOwnedInventoryQuantityAction(
      "position-a",
      null,
      correctionForm()
    );
    const second = await adjustOwnedInventoryQuantityAction(
      "position-a",
      null,
      correctionForm()
    );

    const firstKey = mocks.adjust.mock.calls[0]?.[0].idempotencyKey;
    const secondKey = mocks.adjust.mock.calls[1]?.[0].idempotencyKey;

    expect(first?.success).toBe("Bestand von L-26-0236 korrigiert ✓");
    expect(second?.success).toBe("Bestand von L-26-0236 korrigiert ✓");
    expect(firstKey).toMatch(/^manual-adjust:position-a:/);
    expect(secondKey).toMatch(/^manual-adjust:position-a:/);
    expect(secondKey).not.toBe(firstKey);
  });

  it("keeps the existing not-found message when the movement service rejects the position", async () => {
    mocks.adjust.mockRejectedValue(
      Object.assign(new Error("Position fehlt"), { code: "POSITION_NOT_FOUND" })
    );

    const result = await adjustOwnedInventoryQuantityAction(
      "missing-position",
      null,
      correctionForm()
    );

    expect(result?.error).toBe("Charge nicht gefunden.");
  });
});
