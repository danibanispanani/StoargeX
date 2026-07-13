import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  transaction: vi.fn(),
  createBatch: vi.fn(),
  runMigrationImport: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/services/import-migration-service", () => ({
  runMigrationImport: mocks.runMigrationImport,
}));

import { importRowsAction } from "@/lib/actions/import";

describe("import action failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrg.mockResolvedValue({
      userId: "user-a",
      organization: { id: "org-a" },
      db: { importBatch: { create: mocks.createBatch } },
    });
    mocks.transaction.mockRejectedValue(new Error("commit failed"));
    mocks.createBatch.mockResolvedValue({ id: "failed-batch" });
  });

  it("records a failed batch outside the rolled-back import transaction", async () => {
    const result = await importRowsAction(
      "produkte",
      [{ name: "Fire TV Stick" }],
      false,
      { fileName: "produkte.csv", fileHash: "source-hash" }
    );

    expect(result.error).toBe("commit failed");
    expect(mocks.createBatch).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        fileName: "produkte.csv",
        fileHash: "source-hash",
        importType: "produkte",
        status: "FAILED",
        createdById: "user-a",
        summary: { failure: "commit failed" },
      }),
    });
  });

  it("does not report a committed import as failed when only audit logging rejects", async () => {
    mocks.transaction.mockImplementation(async (callback: (tx: { $executeRaw: ReturnType<typeof vi.fn> }) => unknown) =>
      callback({ $executeRaw: vi.fn().mockResolvedValue(1) })
    );
    mocks.runMigrationImport.mockResolvedValue({
      validCount: 1,
      errors: [],
      importedCount: 1,
      batchId: "completed-batch",
      summary: { reviewRequired: 0, conflicts: 0 },
    });
    mocks.writeAuditLog.mockRejectedValue(new Error("audit unavailable"));

    const result = await importRowsAction("produkte", [{ name: "Fire TV Stick" }], false);

    expect(result.importedCount).toBe(1);
    expect(result.warning).toMatch(/abgeschlossen/);
    expect(mocks.createBatch).not.toHaveBeenCalled();
  });
});
