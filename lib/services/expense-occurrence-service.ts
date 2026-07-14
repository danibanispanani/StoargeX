import type { ExpenseRecurrenceInterval } from "@prisma/client";

export interface ExpenseOccurrenceRule {
  ruleId: string;
  interval: ExpenseRecurrenceInterval | null;
  intervalCount: number;
  startsAt: Date;
  endsAt: Date | null;
}

export interface PlannedExpenseOccurrence {
  at: Date;
  occurrenceKey: string;
}

export function buildExpenseOccurrenceKey(ruleId: string, at: Date) {
  return `${ruleId}:${at.toISOString().slice(0, 10)}`;
}

export function planExpenseOccurrences(
  rule: ExpenseOccurrenceRule,
  through: Date,
  existingKeys: readonly string[]
): PlannedExpenseOccurrence[] {
  if (!rule.interval) return [];
  if (!Number.isInteger(rule.intervalCount) || rule.intervalCount < 1) {
    throw new Error("Das Wiederholungsintervall muss mindestens 1 sein.");
  }
  const existing = new Set(existingKeys);
  const result: PlannedExpenseOccurrence[] = [];
  let cursor = new Date(rule.startsAt);
  let guard = 0;
  while (cursor <= through && (!rule.endsAt || cursor <= rule.endsAt)) {
    const occurrenceKey = buildExpenseOccurrenceKey(rule.ruleId, cursor);
    if (!existing.has(occurrenceKey)) result.push({ at: new Date(cursor), occurrenceKey });
    cursor = addIntervalUtc(cursor, rule.interval, rule.intervalCount);
    guard += 1;
    if (guard > 10_000) throw new Error("Zu viele Ausgaben-Vorkommen in einem Materialisierungslauf.");
  }
  return result;
}

function addIntervalUtc(at: Date, interval: ExpenseRecurrenceInterval, count: number) {
  const result = new Date(at);
  if (interval === "DAY") result.setUTCDate(result.getUTCDate() + count);
  else if (interval === "WEEK") result.setUTCDate(result.getUTCDate() + count * 7);
  else if (interval === "MONTH") addMonthsClampedUtc(result, count);
  else if (interval === "QUARTER") addMonthsClampedUtc(result, count * 3);
  else if (interval === "YEAR") addMonthsClampedUtc(result, count * 12);
  return result;
}

function addMonthsClampedUtc(date: Date, months: number) {
  const desiredDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(desiredDay, lastDay));
}
