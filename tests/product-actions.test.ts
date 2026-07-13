import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  saveImage: vi.fn(),
  productFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  productCreate: vi.fn(),
  productUpdate: vi.fn(),
  productDelete: vi.fn(),
  productUpdateMany: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/uploads", () => ({ saveImage: mocks.saveImage }));

import {
  bulkCategorizeProductsAction,
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/lib/actions/products";

function productForm() {
  const form = new FormData();
  form.set("name", "Fire TV Stick");
  form.set("variant", "4K Max");
  form.set("brand", "Amazon");
  form.set("category", "Elektronik");
  form.set("ean", "840080588582");
  form.set("size", "Standard");
  form.set("defaultPrice", "34,99");
  return form;
}

describe("product actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrg.mockResolvedValue({
      userId: "user-a",
      organization: { id: "org-a", lowStockThreshold: 2 },
      db: {
        product: {
          findFirst: mocks.productFindFirst,
          findMany: mocks.productFindMany,
          create: mocks.productCreate,
          update: mocks.productUpdate,
          delete: mocks.productDelete,
          updateMany: mocks.productUpdateMany,
        },
      },
    });
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("persists brand and size through the existing product create action", async () => {
    mocks.productFindFirst.mockResolvedValue(null);
    mocks.productCreate.mockResolvedValue({
      id: "p1",
      name: "Fire TV Stick",
      variant: "4K Max",
    });

    const result = await createProductAction(null, productForm());

    expect(result?.success).toContain("Fire TV Stick");
    expect(mocks.productCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        brand: "Amazon",
        size: "Standard",
      }),
    });
  });

  it("blocks deletion when domain references still use the product", async () => {
    mocks.productFindFirst.mockResolvedValue({
      id: "p1",
      name: "Fire TV Stick",
      _count: { purchaseLines: 1, inventoryPositions: 0, saleLines: 0 },
    });

    const result = await deleteProductAction("p1");

    expect(result?.error).toMatch(/verwendet/);
    expect(mocks.productDelete).not.toHaveBeenCalled();
  });

  it("persists brand and size through the existing product update action", async () => {
    mocks.productFindFirst.mockResolvedValue({
      id: "p1",
      name: "Fire TV Stick",
      imageUrls: [],
    });
    mocks.productUpdate.mockResolvedValue({ id: "p1" });

    const result = await updateProductAction("p1", null, productForm());

    expect(result?.success).toContain("Fire TV Stick");
    expect(mocks.productUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ brand: "Amazon", size: "Standard" }),
    });
  });

  it("deletes an unreferenced tenant product after the preflight", async () => {
    mocks.productFindFirst.mockResolvedValue({
      id: "p1",
      name: "Fire TV Stick",
      _count: { purchaseLines: 0, inventoryPositions: 0, saleLines: 0 },
    });
    mocks.productDelete.mockResolvedValue({ id: "p1" });

    const result = await deleteProductAction("p1");

    expect(result?.success).toMatch(/gelöscht/);
    expect(mocks.productDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("resolves bulk selections through the tenant client before updating", async () => {
    mocks.productFindMany.mockResolvedValue([{ id: "tenant-p1" }]);
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });

    const result = await bulkCategorizeProductsAction({
      category: "Streaming",
      expectedCount: 1,
      selection: { mode: "explicit", ids: ["tenant-p1", "foreign-p9"] },
      query: { brand: "Amazon" },
    });

    expect(result?.success).toMatch(/1 Produkt/);
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { brand: { equals: "Amazon", mode: "insensitive" } },
            { id: { in: ["tenant-p1", "foreign-p9"] } },
          ]),
        }),
      })
    );
    expect(mocks.productUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tenant-p1"] } },
      data: { category: "Streaming" },
    });
  });

  it("skips no-op bulk categorization when every selected product already matches", async () => {
    mocks.productFindMany.mockResolvedValue([{ id: "tenant-p1", category: "Streaming" }]);

    const result = await bulkCategorizeProductsAction({
      category: "Streaming",
      expectedCount: 1,
      selection: { mode: "explicit", ids: ["tenant-p1"] },
      query: {},
    });

    expect(result?.success).toMatch(/bereits/);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a bulk action when the selected result set changed", async () => {
    mocks.productFindMany.mockResolvedValue([{ id: "tenant-p1", category: null }]);

    const result = await bulkCategorizeProductsAction({
      category: "Streaming",
      expectedCount: 2,
      selection: { mode: "all", excludedIds: [] },
      query: {},
    });

    expect(result?.error).toMatch(/Ergebnismenge/);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an all-result action when product identities changed at the same count", async () => {
    mocks.productFindMany.mockResolvedValue([{ id: "replacement-p2", category: null }]);

    const result = await bulkCategorizeProductsAction({
      category: "Streaming",
      expectedCount: 1,
      expectedResultDigest: "0".repeat(64),
      selection: { mode: "all", excludedIds: [] },
      query: {},
    });

    expect(result?.error).toMatch(/Ergebnismenge/);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });
});
