export type BillingWebhookProcessingStatus =
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED";

export interface BillingWebhookEventRecord {
  eventId: string;
  status: BillingWebhookProcessingStatus;
  attemptCount: number;
}

export interface BillingWebhookEventDescriptor {
  id: string;
  type: string;
  organizationId?: string | null;
  payloadSummary?: Readonly<Record<string, unknown>>;
}

export interface BillingWebhookDependencies<TContext> {
  withEventLock<T>(
    eventId: string,
    work: (context: TContext) => Promise<T>
  ): Promise<T>;
  findEvent(
    context: TContext,
    eventId: string
  ): Promise<BillingWebhookEventRecord | null>;
  markProcessing(
    context: TContext,
    event: BillingWebhookEventDescriptor
  ): Promise<void>;
  apply(
    context: TContext,
    event: BillingWebhookEventDescriptor
  ): Promise<void>;
  markProcessed(context: TContext, eventId: string): Promise<void>;
  recordFailure(
    event: BillingWebhookEventDescriptor,
    errorMessage: string
  ): Promise<void>;
}

export async function executeIdempotentBillingWebhook<TContext>(
  event: BillingWebhookEventDescriptor,
  dependencies: BillingWebhookDependencies<TContext>
): Promise<{ outcome: "processed" | "duplicate" }> {
  try {
    return await dependencies.withEventLock(event.id, async (context) => {
      const existing = await dependencies.findEvent(context, event.id);
      if (
        existing?.status === "PROCESSED" ||
        existing?.status === "PROCESSING"
      ) {
        return { outcome: "duplicate" as const };
      }

      await dependencies.markProcessing(context, event);
      await dependencies.apply(context, event);
      await dependencies.markProcessed(context, event.id);
      return { outcome: "processed" as const };
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Verarbeitungsfehler";
    try {
      await dependencies.recordFailure(event, errorMessage);
    } catch (recordError) {
      console.error(
        "[billing] Fehlgeschlagenes Webhook-Event konnte nicht protokolliert werden.",
        recordError
      );
    }
    throw error;
  }
}
