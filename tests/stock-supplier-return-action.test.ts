import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  createSupplierReturn: vi.fn(),
  findPosition: vi.fn(),
  findReturn: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/services/supplier-return-service", () => ({
  ACTIVE_SUPPLIER_RETURN_PLAN_STATUSES: ["DRAFT", "REQUESTED", "APPROVED"],
  calculateSupplierReturnableQuantity: (
    available: number,
    lines: Array<{ sourceBucket: string; quantity: number }>
  ) => available - lines
    .filter((line) => line.sourceBucket === "AVAILABLE")
    .reduce((sum, line) => sum + line.quantity, 0),
  createSupplierReturn: mocks.createSupplierReturn,
  SupplierReturnDomainError: class SupplierReturnDomainError extends Error {},
  dispatchSupplierReturn: vi.fn(),
  recordSupplierReturnRefund: vi.fn(),
  transitionSupplierReturn: vi.fn(),
}));

import { createSupplierReturnFromStockAction } from "@/lib/actions/supplier-returns";

function form(overrides: Record<string, string> = {}) {
  const value = new FormData();
  value.set("mode", "PARTIAL");
  value.set("quantity", "2");
  value.set("reason", "Falsche Ausführung");
  value.set("idempotencyKey", "0f29d224-65cb-4d17-89e2-a0ff5de318aa");
  for (const [key, entry] of Object.entries(overrides)) value.set(key, entry);
  return value;
}

describe("supplier return from stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrg.mockResolvedValue({
      organization: { id: "org-a" },
      userId: "user-a",
      db: {
        inventoryPosition: { findFirst: mocks.findPosition },
        supplierReturn: { findFirst: mocks.findReturn },
      },
    });
    mocks.findReturn.mockResolvedValue(null);
    mocks.findPosition.mockResolvedValue({
      id: "position-a",
      inventoryType: "OWNED",
      quantityAvailable: 4,
      supplierReturnLines: [],
      ownedLot: {
        purchaseLine: { id: "line-a", purchase: { id: "purchase-a" } },
      },
    });
    mocks.createSupplierReturn.mockResolvedValue({
      id: "return-a",
      returnNumber: "LR-26-0001",
    });
  });

  it("plans a valid partial return without a stock movement", async () => {
    const result = await createSupplierReturnFromStockAction("position-a", null, form());

    expect(mocks.requireOrg).toHaveBeenCalledWith("MEMBER");
    expect(mocks.createSupplierReturn).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      idempotencyKey: "0f29d224-65cb-4d17-89e2-a0ff5de318aa",
      selections: [{
        purchaseLineId: "line-a",
        inventoryPositionId: "position-a",
        sourceBucket: "AVAILABLE",
        quantity: 2,
        reason: "Falsche Ausführung",
        itemCondition: null,
      }],
    }));
    expect(result?.redirectTo).toBe("/retouren/lieferanten?q=LR-26-0001");
  });

  it("uses the complete currently returnable quantity", async () => {
    mocks.findPosition.mockResolvedValue({
      id: "position-a",
      inventoryType: "OWNED",
      quantityAvailable: 5,
      supplierReturnLines: [{ quantity: 2, sourceBucket: "AVAILABLE" }],
      ownedLot: {
        purchaseLine: { id: "line-a", purchase: { id: "purchase-a" } },
      },
    });

    await createSupplierReturnFromStockAction(
      "position-a",
      null,
      form({ mode: "FULL", quantity: "999" })
    );

    expect(mocks.createSupplierReturn.mock.calls[0]?.[0].selections[0].quantity).toBe(3);
  });

  it.each(["0", "-1", "5"])("rejects unavailable partial quantity %s", async (quantity) => {
    const result = await createSupplierReturnFromStockAction(
      "position-a",
      null,
      form({ quantity })
    );
    expect(result?.error).toMatch(/Menge/);
    expect(mocks.createSupplierReturn).not.toHaveBeenCalled();
  });

  it("rejects consignment stock server-side", async () => {
    mocks.findPosition.mockResolvedValue({
      id: "position-a",
      inventoryType: "CONSIGNMENT",
      quantityAvailable: 4,
      supplierReturnLines: [],
      ownedLot: null,
    });

    const result = await createSupplierReturnFromStockAction("position-a", null, form());

    expect(result?.error).toMatch(/Eigenbestand/);
    expect(mocks.createSupplierReturn).not.toHaveBeenCalled();
  });

  it("returns the existing planned return before rechecking a stale quantity", async () => {
    mocks.findReturn.mockResolvedValue({
      id: "return-a",
      returnNumber: "LR-26-0001",
      lines: [{ id: "return-line-a" }],
    });
    mocks.findPosition.mockResolvedValue({
      id: "position-a",
      inventoryType: "OWNED",
      quantityAvailable: 0,
      supplierReturnLines: [{ quantity: 4, sourceBucket: "AVAILABLE" }],
      ownedLot: {
        purchaseLine: { id: "line-a", purchase: { id: "purchase-a" } },
      },
    });

    const result = await createSupplierReturnFromStockAction("position-a", null, form());

    expect(result?.redirectTo).toBe("/retouren/lieferanten?q=LR-26-0001");
    expect(mocks.findPosition).not.toHaveBeenCalled();
    expect(mocks.createSupplierReturn).not.toHaveBeenCalled();
  });

  it("does not reveal unknown service errors", async () => {
    mocks.createSupplierReturn.mockRejectedValue(new Error("P2002 Unique constraint SupplierReturn_org_key"));

    const result = await createSupplierReturnFromStockAction("position-a", null, form());

    expect(result?.error).toBe("Lieferantenretoure konnte nicht erstellt werden.");
  });

  it("does not resolve tenant-foreign positions", async () => {
    mocks.findPosition.mockResolvedValue(null);

    const result = await createSupplierReturnFromStockAction("foreign-position", null, form());

    expect(result?.error).toBe("Lagerposition wurde nicht gefunden.");
    expect(mocks.createSupplierReturn).not.toHaveBeenCalled();
  });

  it("enforces the member role on the server", async () => {
    mocks.requireOrg.mockRejectedValue(new Error("Keine Berechtigung"));

    await expect(
      createSupplierReturnFromStockAction("position-a", null, form())
    ).rejects.toThrow("Keine Berechtigung");
    expect(mocks.requireOrg).toHaveBeenCalledWith("MEMBER");
  });
});
