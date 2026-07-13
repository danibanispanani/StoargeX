import { describe, expect, it } from "vitest";
import {
  classifyExpenseSchedule,
  nextExpenseOccurrence,
} from "@/lib/services/expense-recurrence-service";

describe("expense recurrence", () => {
  it("behandelt eine Ausgabe ohne Regel als einmalig", () => {
    const occurrence = new Date("2026-07-13T00:00:00.000Z");
    expect(classifyExpenseSchedule(null)).toBe("ONE_TIME");
    expect(nextExpenseOccurrence(occurrence, null)).toBeNull();
  });

  it("berechnet wiederkehrende Tages- und Wochenintervalle", () => {
    const occurrence = new Date("2026-07-13T00:00:00.000Z");
    expect(
      nextExpenseOccurrence(occurrence, { interval: "DAY", intervalCount: 2 })?.toISOString()
    ).toBe("2026-07-15T00:00:00.000Z");
    expect(
      nextExpenseOccurrence(occurrence, { interval: "WEEK", intervalCount: 2 })?.toISOString()
    ).toBe("2026-07-27T00:00:00.000Z");
  });

  it("klemmt Monatsfolgen sicher an das Monatsende", () => {
    expect(
      nextExpenseOccurrence(new Date("2026-01-31T08:30:00.000Z"), {
        interval: "MONTH",
        intervalCount: 1,
      })?.toISOString()
    ).toBe("2026-02-28T08:30:00.000Z");
  });

  it("endet nach dem konfigurierten Enddatum", () => {
    expect(
      nextExpenseOccurrence(new Date("2026-07-13T00:00:00.000Z"), {
        interval: "MONTH",
        intervalCount: 1,
        endsAt: new Date("2026-08-01T00:00:00.000Z"),
      })
    ).toBeNull();
  });
});
