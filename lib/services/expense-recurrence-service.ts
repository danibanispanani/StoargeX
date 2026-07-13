export type ExpenseRecurrenceInterval = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

export interface ExpenseRecurrenceDefinition {
  interval: ExpenseRecurrenceInterval;
  intervalCount: number;
  endsAt?: Date | null;
  active?: boolean;
}

function addMonthsClamped(value: Date, months: number): Date {
  const result = new Date(value.getTime());
  const expectedDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(expectedDay, lastDay));
  return result;
}

export function nextExpenseOccurrence(
  currentOccurrence: Date,
  recurrence: ExpenseRecurrenceDefinition | null
): Date | null {
  if (recurrence === null || recurrence.active === false) return null;
  if (!Number.isInteger(recurrence.intervalCount) || recurrence.intervalCount < 1) {
    throw new Error("intervalCount muss eine positive ganze Zahl sein.");
  }

  const next = new Date(currentOccurrence.getTime());
  switch (recurrence.interval) {
    case "DAY":
      next.setUTCDate(next.getUTCDate() + recurrence.intervalCount);
      break;
    case "WEEK":
      next.setUTCDate(next.getUTCDate() + recurrence.intervalCount * 7);
      break;
    case "MONTH":
      return withinRecurrenceEnd(
        addMonthsClamped(next, recurrence.intervalCount),
        recurrence.endsAt
      );
    case "QUARTER":
      return withinRecurrenceEnd(
        addMonthsClamped(next, recurrence.intervalCount * 3),
        recurrence.endsAt
      );
    case "YEAR":
      return withinRecurrenceEnd(
        addMonthsClamped(next, recurrence.intervalCount * 12),
        recurrence.endsAt
      );
  }

  return withinRecurrenceEnd(next, recurrence.endsAt);
}

function withinRecurrenceEnd(next: Date, endsAt?: Date | null): Date | null {
  return endsAt && next.getTime() > endsAt.getTime() ? null : next;
}

export function classifyExpenseSchedule(
  recurrence: ExpenseRecurrenceDefinition | null
): "ONE_TIME" | "RECURRING" {
  return recurrence === null ? "ONE_TIME" : "RECURRING";
}
