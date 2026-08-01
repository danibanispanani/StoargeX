import { describe, expect, it, vi } from "vitest";
import { getOptionsForKinds } from "@/lib/options";
import type { TenantDb } from "@/lib/tenant-db";

describe("stock option loader", () => {
  it("loads both stock option kinds in one tenant-scoped query", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { kind: "PAYMENT_METHOD", label: "Firma" },
      { kind: "STORAGE_LOCATION", label: "Regal A" },
    ]);
    const createMany = vi.fn();
    const db = { selectOption: { findMany, createMany } } as unknown as TenantDb;

    const result = await getOptionsForKinds(
      db,
      "org-a",
      ["PAYMENT_METHOD", "STORAGE_LOCATION"],
      { seedMissing: false }
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: "org-a",
        kind: { in: ["PAYMENT_METHOD", "STORAGE_LOCATION"] },
        active: true,
      },
    }));
    expect(createMany).not.toHaveBeenCalled();
    expect(result.PAYMENT_METHOD).toEqual(["Firma"]);
    expect(result.STORAGE_LOCATION).toEqual(["Regal A"]);
  });

  it("keeps the existing lazy seed behavior for missing kinds", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ kind: "STORAGE_LOCATION", label: "Lager" }])
      .mockResolvedValueOnce([
        { kind: "PAYMENT_METHOD", label: "Firma" },
        { kind: "STORAGE_LOCATION", label: "Lager" },
      ]);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { selectOption: { findMany, createMany } } as unknown as TenantDb;

    const result = await getOptionsForKinds(
      db,
      "org-a",
      ["PAYMENT_METHOD", "STORAGE_LOCATION"]
    );

    expect(createMany).toHaveBeenCalledOnce();
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ organizationId: "org-a", kind: "PAYMENT_METHOD" }),
      ]),
      skipDuplicates: true,
    }));
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(result.STORAGE_LOCATION).toEqual(["Lager"]);
  });
});
