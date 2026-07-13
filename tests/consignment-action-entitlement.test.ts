import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class FeatureAccessDeniedError extends Error {
    constructor(public readonly featureKey: "CONSIGNMENT") {
      super(`Feature ${featureKey} ist für diese Organisation nicht aktiviert.`);
      this.name = "FeatureAccessDeniedError";
    }
  }

  return {
    FeatureAccessDeniedError,
    requireOrgFeature: vi.fn(),
  };
});

vi.mock("@/lib/feature-access", () => ({
  FeatureAccessDeniedError: mocks.FeatureAccessDeniedError,
  requireOrgFeature: mocks.requireOrgFeature,
}));

import {
  adjustConsignmentStockAction,
  createConsignmentItemAction,
  deleteConsignmentItemAction,
  linkConsignmentSalesAction,
  updateConsignmentCountsAction,
  updateConsignmentItemAction,
} from "@/lib/actions/consignment";

describe("consignment mutation entitlement guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgFeature.mockRejectedValue(
      new mocks.FeatureAccessDeniedError("CONSIGNMENT")
    );
  });

  it("liefert bei abgelaufenem Zugriff für alle Mutationen einen Action-Fehler", async () => {
    const formData = new FormData();
    const expected = {
      error: "Feature CONSIGNMENT ist für diese Organisation nicht aktiviert.",
    };

    await expect(createConsignmentItemAction({}, formData)).resolves.toEqual(expected);
    await expect(
      updateConsignmentCountsAction("legacy-1", {}, formData)
    ).resolves.toEqual(expected);
    await expect(
      adjustConsignmentStockAction("position-1", {}, formData)
    ).resolves.toEqual(expected);
    await expect(
      updateConsignmentItemAction("position-1", {}, formData)
    ).resolves.toEqual(expected);
    await expect(deleteConsignmentItemAction("position-1")).resolves.toEqual(expected);
    await expect(linkConsignmentSalesAction("legacy-1", [])).resolves.toEqual(expected);

    expect(mocks.requireOrgFeature).toHaveBeenCalledTimes(6);
  });
});
