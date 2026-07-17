import { describe, expect, it } from "vitest";
import {
  deriveTaskProgress,
  taskAttentionItems,
  validateTaskDomainLink,
} from "@/lib/services/task-workflow-service";

describe("team task workflow", () => {
  it("derives progress from the checklist instead of a free percentage", () => {
    expect(deriveTaskProgress({
      status: "IN_PROGRESS",
      checklist: [{ completed: true }, { completed: true }, { completed: false }],
    })).toEqual({ mode: "CHECKLIST", completed: 2, total: 3, percent: 67 });
  });

  it("uses only meaningful status progress without a checklist", () => {
    expect(deriveTaskProgress({ status: "OPEN", checklist: [] })).toEqual({
      mode: "STATUS", completed: 0, total: 0, percent: null,
    });
    expect(deriveTaskProgress({ status: "DONE", checklist: [] }).percent).toBe(100);
  });

  it("separates due-soon and overdue attention items", () => {
    const now = new Date("2026-07-15T10:00:00.000Z");
    const items = taskAttentionItems([
      { id: "today", title: "Heute erledigen", dueDate: new Date("2026-07-15T00:00:00.000Z"), status: "OPEN", archived: false },
      { id: "soon", title: "Paket pruefen", dueDate: new Date("2026-07-16T10:00:00.000Z"), status: "OPEN", archived: false },
      { id: "late", title: "Retoure klaeren", dueDate: new Date("2026-07-14T10:00:00.000Z"), status: "IN_PROGRESS", archived: false },
      { id: "done", title: "Erledigt", dueDate: new Date("2026-07-14T10:00:00.000Z"), status: "DONE", archived: false },
      { id: "snoozed", title: "Spaeter", dueDate: new Date("2026-07-14T10:00:00.000Z"), status: "OPEN", archived: false, snoozedUntil: new Date("2026-07-18T00:00:00.000Z") },
    ], now);

    expect(items).toEqual([
      expect.objectContaining({ taskId: "late", kind: "OVERDUE" }),
      expect.objectContaining({ taskId: "today", kind: "DUE_SOON" }),
      expect.objectContaining({ taskId: "soon", kind: "DUE_SOON" }),
    ]);
  });

  it("rejects cross-tenant and ambiguous domain links", () => {
    expect(() => validateTaskDomainLink({
      organizationId: "org-a",
      type: "PURCHASE",
      targets: [{ type: "PURCHASE", id: "purchase-a", organizationId: "org-b" }],
    })).toThrowError(/Organisation/);
    expect(() => validateTaskDomainLink({
      organizationId: "org-a",
      type: "SALE",
      targets: [
        { type: "SALE", id: "sale-a", organizationId: "org-a" },
        { type: "DEBT", id: "debt-a", organizationId: "org-a" },
      ],
    })).toThrowError(/genau ein/);
  });
});
