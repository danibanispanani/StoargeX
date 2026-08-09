import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  task: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import { withTenantReadTransaction } from "@/lib/tenant-db";

describe("withTenantReadTransaction", () => {
  it("setzt SET LOCAL im selben Prisma-Transaktionskontext vor der Read-Task", async () => {
    const calls: string[] = [];
    const tx = {
      $executeRaw: mocks.executeRaw.mockImplementation(() => {
        calls.push("set-local");
        return Promise.resolve(1);
      }),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.task.mockImplementation(async (receivedTx) => {
      calls.push(receivedTx === tx ? "task-same-tx" : "task-other-tx");
      return "ok";
    });

    await expect(withTenantReadTransaction("org-a", mocks.task)).resolves.toBe("ok");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.task).toHaveBeenCalledWith(tx);
    expect(calls).toEqual(["set-local", "task-same-tx"]);
  });
});
