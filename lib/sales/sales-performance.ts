import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

type TraceDetails = Record<string, number | string | boolean | null>;

interface TraceSpan {
  name: string;
  durationMs: number;
  dbQueries: number;
  ok: boolean;
}

const REQUEST_ID_HEADER = "x-storagex-request-id";

export class SalesPerformanceTrace {
  readonly enabled = process.env.NODE_ENV === "development";
  readonly correlationId: string;

  private readonly startedAt = performance.now();
  private readonly spans: TraceSpan[] = [];
  private activeDbQueries = 0;
  private maximumDbConcurrency = 0;
  private databaseQueries = 0;
  private queryGroups = 0;
  private finished = false;

  constructor(
    readonly operation: string,
    correlationId?: string
  ) {
    this.correlationId = correlationId || randomUUID();
  }

  record(
    name: string,
    durationMs: number,
    details?: { dbQueries?: number; queryGroups?: number; ok?: boolean }
  ): void {
    if (!this.enabled) return;
    const dbQueries = details?.dbQueries ?? 0;
    this.spans.push({
      name,
      durationMs: round(durationMs),
      dbQueries,
      ok: details?.ok ?? true,
    });
    this.queryGroups += details?.queryGroups ?? (dbQueries > 0 ? 1 : 0);
  }

  async measure<T>(name: string, task: () => Promise<T>): Promise<T> {
    if (!this.enabled) return task();
    const startedAt = performance.now();
    let ok = true;
    try {
      return await task();
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      this.record(name, performance.now() - startedAt, { ok });
    }
  }

  async measureDb<T>(name: string, task: () => Promise<T>, dbQueries = 2): Promise<T> {
    if (!this.enabled) return task();
    const startedAt = performance.now();
    this.databaseQueries += dbQueries;
    this.activeDbQueries += dbQueries;
    this.maximumDbConcurrency = Math.max(this.maximumDbConcurrency, this.activeDbQueries);
    try {
      const result = await task();
      this.record(name, performance.now() - startedAt, {
        dbQueries,
        queryGroups: 1,
      });
      return result;
    } catch (error) {
      this.record(name, performance.now() - startedAt, {
        dbQueries,
        queryGroups: 1,
        ok: false,
      });
      throw error;
    } finally {
      this.activeDbQueries -= dbQueries;
    }
  }

  finish(details: TraceDetails = {}): void {
    if (!this.enabled || this.finished) return;
    this.finished = true;
    console.info(
      `[sales-performance] ${JSON.stringify({
        correlationId: this.correlationId,
        operation: this.operation,
        runtime: "application-only",
        durationMs: round(performance.now() - this.startedAt),
        databaseQueries: this.databaseQueries,
        queryGroups: this.queryGroups,
        maximumDbConcurrency: this.maximumDbConcurrency,
        spans: this.spans,
        ...details,
      })}`
    );
  }

  async run<T>(task: () => Promise<T>, details: TraceDetails = {}): Promise<T> {
    try {
      return await task();
    } finally {
      this.finish(details);
    }
  }
}

export async function createSalesPerformanceTrace(operation: string): Promise<SalesPerformanceTrace> {
  if (process.env.NODE_ENV !== "development") {
    return new SalesPerformanceTrace(operation);
  }
  const requestHeaders = await headers();
  return new SalesPerformanceTrace(operation, requestHeaders.get(REQUEST_ID_HEADER) ?? undefined);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
