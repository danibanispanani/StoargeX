import { describe, expect, it } from "vitest";
import {
  buildExpenseOccurrenceKey,
  planExpenseOccurrences,
} from "@/lib/services/expense-occurrence-service";

describe("expense occurrence materialization", () => {
  it("erzeugt für einmalige Ausgaben keine Folgezeile", () => {
    expect(planExpenseOccurrences({ ruleId: "rule-1", interval: null, intervalCount: 1, startsAt: new Date("2026-07-01Z"), endsAt: null }, new Date("2026-09-01Z"), [])).toEqual([]);
  });

  it("plant Monatsbuchungen idempotent und ohne doppelten occurrence key", () => {
    const existing = [buildExpenseOccurrenceKey("rule-1", new Date("2026-07-31T00:00:00.000Z"))];
    const planned = planExpenseOccurrences({
      ruleId: "rule-1",
      interval: "MONTH",
      intervalCount: 1,
      startsAt: new Date("2026-07-31T00:00:00.000Z"),
      endsAt: null,
    }, new Date("2026-09-30T23:59:59.999Z"), existing);
    expect(planned.map((item) => item.at.toISOString())).toEqual([
      "2026-08-31T00:00:00.000Z",
      "2026-09-30T00:00:00.000Z",
    ]);
    expect(new Set(planned.map((item) => item.occurrenceKey)).size).toBe(2);
  });
});
