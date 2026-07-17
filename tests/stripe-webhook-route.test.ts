import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.retrieveSubscription },
  }),
  billingPriceCatalog: vi.fn(),
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("rejects a missing signature before any billing mutation", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid Stripe signature before any billing mutation", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: "{\"id\":\"evt_1\"}",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      "{\"id\":\"evt_1\"}",
      "invalid",
      "whsec_test"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("loads the canonical subscription state before processing an event", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_updated",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1" } },
    });
    mocks.retrieveSubscription.mockResolvedValue({
      id: "sub_1",
      customer: "cus_1",
      status: "canceled",
      cancel_at_period_end: false,
      trial_end: null,
      created: 1,
      items: { data: [] },
      metadata: {},
    });
    mocks.transaction.mockImplementation(async (work) =>
      work({
        $executeRaw: vi.fn(),
        organization: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: "{\"id\":\"evt_updated\"}",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(await response.json()).toEqual({ received: true, ignored: true });
  });
});
