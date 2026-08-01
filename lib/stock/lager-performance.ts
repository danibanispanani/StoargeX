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

export class LagerPerformanceTrace {
  readonly enabled = process.env.NODE_ENV === "development";
  readonly correlationId: string;

  private readonly startedAt = performance.now();
  private readonly spans: TraceSpan[] = [];
  private activeDbQueries = 0;
  private maximumDbConcurrency = 0;
  private databaseQueries = 0;
  private finished = false;

  constructor(
    readonly operation: string,
    correlationId?: string
  ) {
    this.correlationId = correlationId || randomUUID();
  }

  record(name: string, durationMs: number, details?: { dbQueries?: number; ok?: boolean }): void {
    if (!this.enabled) return;
    this.spans.push({
      name,
      durationMs: round(durationMs),
      dbQueries: details?.dbQueries ?? 0,
      ok: details?.ok ?? true,
    });
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

  measureSync<T>(name: string, task: () => T): T {
    if (!this.enabled) return task();
    const startedAt = performance.now();
    let ok = true;
    try {
      return task();
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      this.record(name, performance.now() - startedAt, { ok });
    }
  }

  async measureDb<T>(name: string, task: () => Promise<T>, queryCount = 1): Promise<T> {
    if (!this.enabled) return task();
    const startedAt = performance.now();
    this.databaseQueries += queryCount;
    this.activeDbQueries += queryCount;
    this.maximumDbConcurrency = Math.max(this.maximumDbConcurrency, this.activeDbQueries);
    try {
      const result = await task();
      this.record(name, performance.now() - startedAt, { dbQueries: queryCount });
      return result;
    } catch (error) {
      this.record(name, performance.now() - startedAt, { dbQueries: queryCount, ok: false });
      throw error;
    } finally {
      this.activeDbQueries -= queryCount;
    }
  }

  finish(details: TraceDetails = {}): void {
    if (!this.enabled || this.finished) return;
    this.finished = true;
    console.info(
      `[lager-performance] ${JSON.stringify({
        correlationId: this.correlationId,
        operation: this.operation,
        runtime: "application-only",
        durationMs: round(performance.now() - this.startedAt),
        databaseQueries: this.databaseQueries,
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

export async function createLagerPerformanceTrace(operation: string): Promise<LagerPerformanceTrace> {
  if (process.env.NODE_ENV !== "development") {
    return new LagerPerformanceTrace(operation);
  }
  const requestHeaders = await headers();
  return new LagerPerformanceTrace(operation, requestHeaders.get(REQUEST_ID_HEADER) ?? undefined);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
