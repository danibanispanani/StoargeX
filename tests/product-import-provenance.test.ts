import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { runMigrationImport } from "@/lib/services/import-migration-service";

describe("product import provenance", () => {
  it("commits products through ImportBatch and SourceReference", async () => {
    const createBatch = vi.fn().mockResolvedValue({ id: "batch-1" });
    const updateBatch = vi.fn().mockResolvedValue({ id: "batch-1" });
    const createProducts = vi.fn().mockResolvedValue([
      { id: "product-1", name: "Fire TV Stick", variant: "4K Max" },
    ]);
    const createSources = vi.fn().mockResolvedValue({ count: 1 });
    const executeRaw = vi.fn().mockResolvedValue(1);
    const tx = {
      $executeRaw: executeRaw,
      sourceReference: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: createSources,
      },
      inventoryPosition: { findMany: vi.fn().mockResolvedValue([]) },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        createManyAndReturn: createProducts,
      },
      importBatch: { create: createBatch, update: updateBatch },
    } as unknown as Prisma.TransactionClient;

    const result = await runMigrationImport({
      tx,
      organizationId: "org-a",
      createdById: "user-a",
      table: "produkte",
      rows: [{ name: "Fire TV Stick", variant: "4K Max", standard_ek: "34,99" }],
      dryRun: false,
      allowConsignment: false,
      metadata: { fileName: "produkte.xlsx", fileHash: "hash-1", sheetName: "Import" },
    });

    expect(result.importedCount).toBe(1);
    expect(executeRaw).toHaveBeenCalledOnce();
    expect(createBatch).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        importType: "produkte",
        fileName: "produkte.xlsx",
        fileHash: "hash-1",
      }),
    });
    expect(createProducts).toHaveBeenCalledWith({
      data: [expect.objectContaining({
          organizationId: "org-a",
          name: "Fire TV Stick",
          variant: "4K Max",
          defaultPriceCents: 3499,
        })],
      select: { id: true, name: true, variant: true },
    });
    expect(createSources).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        organizationId: "org-a",
        importBatchId: "batch-1",
        targetEntity: "PRODUCT",
        targetEntityId: "product-1",
        sheetName: "Import",
        rowNumber: 1,
        rowHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        legacyReference: "FIRE TV STICK|4K MAX",
        status: "NEW",
        warnings: [],
        errors: [],
      })],
    });
  });
});
