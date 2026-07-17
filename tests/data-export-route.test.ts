import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const mocks = vi.hoisted(() => ({
  apiOrg: vi.fn(),
  loadDataset: vi.fn(),
  loadOrganization: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ resolveApiOrgContext: mocks.apiOrg }));
vi.mock("@/lib/data-portability/export-datasets", () => ({
  loadExportDataset: mocks.loadDataset,
  filterPortableRows: (rows: Array<Record<string, unknown>>, query: string) =>
    query ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())) : rows,
}));
vi.mock("@/lib/data-portability/organization-data", () => ({
  loadOrganizationPortableData: mocks.loadOrganization,
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));

import { GET } from "@/app/api/export-data/[dataset]/route";

const route = (dataset: string) => ({ params: Promise.resolve({ dataset }) });

describe("data export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiOrg.mockResolvedValue({
      ok: true,
      context: {
        db: { tenant: "org-a" },
        userId: "user-a",
        organization: { id: "org-a", name: "Org A", slug: "org-a" },
      },
    });
    mocks.loadDataset.mockResolvedValue([
      { Artikel: "Fire TV", EAN: "123", Intern: "=FORMULA()" },
      { Artikel: "Andere Ware", EAN: "456", Intern: "ok" },
    ]);
    mocks.loadOrganization.mockResolvedValue({
      format: "storagex-portable-export-v2",
      exportedAt: "2026-07-17T00:00:00.000Z",
      organization: { id: "org-a", name: "Org A" },
      products: [{ name: "Fire TV" }],
    });
  });

  it("requires tenant access and rejects unknown datasets", async () => {
    expect((await GET(new Request("http://localhost/api/export-data/nope"), route("nope"))).status).toBe(404);

    mocks.apiOrg.mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await GET(
      new Request("http://localhost/api/export-data/inventory-ledger"),
      route("inventory-ledger")
    )).status).toBe(401);
  });

  it("uses the tenant client and applies search plus explicit columns to CSV", async () => {
    const response = await GET(
      new Request("http://localhost/api/export-data/inventory-ledger?format=csv&q=fire&columns=EAN&columns=Artikel"),
      route("inventory-ledger")
    );

    expect(mocks.apiOrg).toHaveBeenCalledWith("READONLY");
    expect(mocks.loadDataset).toHaveBeenCalledWith({ tenant: "org-a" }, "inventory-ledger");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe("EAN;Artikel\r\n123;Fire TV");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("applies search before enforcing the synchronous row limit", async () => {
    mocks.loadDataset.mockResolvedValue([
      ...Array.from({ length: 50_000 }, (_, index) => ({
        Artikel: `Andere Ware ${index}`,
        EAN: String(index),
      })),
      { Artikel: "Gesuchter Artikel", EAN: "MATCH" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/export-data/inventory-ledger?format=csv&q=gesuchter"),
      route("inventory-ledger")
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Gesuchter Artikel");
  });

  it("requires OWNER and creates an audited multi-sheet full XLSX", async () => {
    const response = await GET(
      new Request("http://localhost/api/export-data/vollauszug?format=xlsx"),
      route("vollauszug")
    );
    const workbook = XLSX.read(await response.arrayBuffer());
    const manifest = XLSX.utils.sheet_to_json(workbook.Sheets.Manifest);

    expect(mocks.apiOrg).toHaveBeenCalledWith("OWNER");
    expect(mocks.loadOrganization).toHaveBeenCalledWith(
      { tenant: "org-a" },
      expect.objectContaining({ id: "org-a" })
    );
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Manifest", "organization", "products"]));
    expect(JSON.stringify(manifest)).toContain("Secrets sind ausgeschlossen");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      action: "organization.full_export",
    }));
  });

  it("does not offer an ambiguous multi-table CSV", async () => {
    const response = await GET(
      new Request("http://localhost/api/export-data/vollauszug?format=csv"),
      route("vollauszug")
    );

    expect(response.status).toBe(422);
  });
});
