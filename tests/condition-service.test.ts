import { describe, expect, it } from "vitest";
import {
  mapLegacyCondition,
  resolveItemCondition,
} from "@/lib/services/condition-service";

describe("condition mapping", () => {
  it.each([
    ["Neuware", "NEW"],
    ["Open Box", "OPEN_BOX"],
    ["generalüberholt", "REFURBISHED"],
    ["gebraucht", "USED"],
    ["beschädigt", "DEFECTIVE"],
  ] as const)("mappt %s auf %s", (legacy, expected) => {
    expect(mapLegacyCondition(legacy)).toBe(expected);
  });

  it("lässt unbekannte Legacywerte unverzwungen", () => {
    expect(mapLegacyCondition("Sonderzustand Händler A")).toBeNull();
  });

  it("bevorzugt den bereits normalisierten Zustand", () => {
    expect(
      resolveItemCondition({ itemCondition: "OPEN_BOX", legacyCondition: "defekt" })
    ).toBe("OPEN_BOX");
  });
});
