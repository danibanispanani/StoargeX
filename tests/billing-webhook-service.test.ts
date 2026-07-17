import { describe, expect, it, vi } from "vitest";
import {
  executeIdempotentBillingWebhook,
  type BillingWebhookEventRecord,
} from "@/lib/services/billing-webhook-service";

function createHarness(initial?: BillingWebhookEventRecord) {
  const records = new Map<string, BillingWebhookEventRecord>();
  if (initial) records.set(initial.eventId, initial);

  const apply = vi.fn(async () => undefined);
  const dependencies = {
    withEventLock: async <T>(
      _eventId: string,
      work: (context: typeof records) => Promise<T>
    ) => work(records),
    findEvent: async (context: typeof records, eventId: string) =>
      context.get(eventId) ?? null,
    markProcessing: async (
      context: typeof records,
      event: { id: string; type: string }
    ) => {
      const existing = context.get(event.id);
      context.set(event.id, {
        eventId: event.id,
        status: "PROCESSING" as const,
        attemptCount: (existing?.attemptCount ?? 0) + 1,
      });
    },
    markProcessed: async (context: typeof records, eventId: string) => {
      const current = context.get(eventId);
      context.set(eventId, {
        eventId,
        status: "PROCESSED" as const,
        attemptCount: current?.attemptCount ?? 1,
      });
    },
    recordFailure: async (event: { id: string }) => {
      const current = records.get(event.id);
      records.set(event.id, {
        eventId: event.id,
        status: "FAILED" as const,
        attemptCount: current?.attemptCount ?? 1,
      });
    },
    apply,
  };

  return { records, apply, dependencies };
}

describe("executeIdempotentBillingWebhook", () => {
  it("applies a Stripe event once and returns duplicate on replay", async () => {
    const harness = createHarness();
    const event = { id: "evt_1", type: "customer.subscription.updated" };

    await expect(
      executeIdempotentBillingWebhook(event, harness.dependencies)
    ).resolves.toEqual({ outcome: "processed" });
    await expect(
      executeIdempotentBillingWebhook(event, harness.dependencies)
    ).resolves.toEqual({ outcome: "duplicate" });

    expect(harness.apply).toHaveBeenCalledTimes(1);
    expect(harness.records.get(event.id)).toMatchObject({
      status: "PROCESSED",
      attemptCount: 1,
    });
  });

  it("records a failed attempt and permits a later retry", async () => {
    const harness = createHarness();
    const event = { id: "evt_retry", type: "checkout.session.completed" };
    harness.apply.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      executeIdempotentBillingWebhook(event, harness.dependencies)
    ).rejects.toThrow("database unavailable");
    expect(harness.records.get(event.id)).toMatchObject({
      status: "FAILED",
      attemptCount: 1,
    });

    await expect(
      executeIdempotentBillingWebhook(event, harness.dependencies)
    ).resolves.toEqual({ outcome: "processed" });
    expect(harness.apply).toHaveBeenCalledTimes(2);
    expect(harness.records.get(event.id)).toMatchObject({
      status: "PROCESSED",
      attemptCount: 2,
    });
  });

  it("does not re-enter an event already marked as processing", async () => {
    const harness = createHarness({
      eventId: "evt_processing",
      status: "PROCESSING",
      attemptCount: 1,
    });

    await expect(
      executeIdempotentBillingWebhook(
        { id: "evt_processing", type: "customer.subscription.updated" },
        harness.dependencies
      )
    ).resolves.toEqual({ outcome: "duplicate" });
    expect(harness.apply).not.toHaveBeenCalled();
  });
});
