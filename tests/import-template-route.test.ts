import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const mocks = vi.hoisted(() => ({
  apiOrg: vi.fn(),
  featureAccess: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ resolveApiOrgContext: mocks.apiOrg }));
vi.mock("@/lib/feature-access", () => ({
  getFeatureAccess: mocks.featureAccess,
}));

import { GET } from "@/app/api/import-template/[table]/route";

const context = (table: string) => ({ params: Promise.resolve({ table }) });

describe("import template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiOrg.mockResolvedValue({
      ok: true,
      context: { organization: { id: "org-a" }, db: {} },
    });
    mocks.featureAccess.mockResolvedValue({ enabled: true, state: "ACTIVE" });
  });

  it("rejects unknown tables, unauthenticated users and missing memberships", async () => {
    expect((await GET(new Request("http://localhost/api/import-template/nope"), context("nope"))).status).toBe(404);
    expect((await GET(new Request("http://localhost/api/import-template/toString"), context("toString"))).status).toBe(404);

    mocks.apiOrg.mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await GET(new Request("http://localhost/api/import-template/produkte"), context("produkte"))).status).toBe(401);

    mocks.apiOrg.mockResolvedValueOnce({ ok: false, status: 403 });
    expect((await GET(new Request("http://localhost/api/import-template/produkte"), context("produkte"))).status).toBe(403);
  });

  it("returns a BOM-prefixed CSV example with download headers", async () => {
    const response = await GET(
      new Request("http://localhost/api/import-template/produkte?format=csv&kind=example"),
      context("produkte")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("beispiel-vorlage.csv");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toMatch(/^Name \*;Variante/);
  });

  it("returns both XLSX sheets", async () => {
    const response = await GET(
      new Request("http://localhost/api/import-template/produkte?format=xlsx&kind=empty"),
      context("produkte")
    );
    const workbook = XLSX.read(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(workbook.SheetNames).toEqual(["Import", "Spaltenbeschreibung"]);
  });

  it("blocks consignment templates without entitlement", async () => {
    mocks.featureAccess.mockResolvedValueOnce({ enabled: false, state: "DISABLED" });

    const response = await GET(
      new Request("http://localhost/api/import-template/konsignation"),
      context("konsignation")
    );

    expect(response.status).toBe(403);
    expect(mocks.featureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ organization: expect.objectContaining({ id: "org-a" }) }),
      "CONSIGNMENT"
    );
  });
});
