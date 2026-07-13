import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiOrg: vi.fn(),
  productFindMany: vi.fn(),
}));

vi.mock("@/lib/org", () => ({ resolveApiOrgContext: mocks.apiOrg }));

import { GET } from "@/app/api/export/[table]/route";

describe("product export filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiOrg.mockResolvedValue({
      ok: true,
      context: {
        organization: { id: "org-a", lowStockThreshold: 2 },
        db: { product: { findMany: mocks.productFindMany } },
      },
    });
    mocks.productFindMany.mockResolvedValue([
      {
        name: "Fire TV Stick",
        variant: "4K Max",
        brand: "Amazon",
        category: "Elektronik",
        ean: "840080588582",
        defaultPriceCents: 3499,
        size: "Standard",
        imageUrls: [],
      },
    ]);
  });

  it("uses the same active search, filters, preset and sort as the product table", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/export/produkte?format=csv&q=fire&category=Elektronik&brand=Amazon&preset=unused&sort=updatedAt&direction=desc"
      ),
      { params: Promise.resolve({ table: "produkte" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.apiOrg).toHaveBeenCalled();
    expect(mocks.productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { name: { contains: "fire", mode: "insensitive" } },
        ]),
        AND: expect.arrayContaining([
          { category: { equals: "Elektronik", mode: "insensitive" } },
          { brand: { equals: "Amazon", mode: "insensitive" } },
          {
            purchaseLines: { none: {} },
            inventoryPositions: { none: {} },
            saleLines: { none: {} },
          },
        ]),
      }),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: expect.objectContaining({ name: true, variant: true, ean: true }),
    }));
    expect(await response.text()).toContain("Fire TV Stick");
  });

  it("rejects unauthenticated and non-member exports", async () => {
    mocks.apiOrg.mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await GET(new Request("http://localhost/api/export/produkte"), { params: Promise.resolve({ table: "produkte" }) })).status).toBe(401);

    mocks.apiOrg.mockResolvedValueOnce({ ok: false, status: 403 });
    expect((await GET(new Request("http://localhost/api/export/produkte"), { params: Promise.resolve({ table: "produkte" }) })).status).toBe(403);
  });

  it("neutralizes formula-leading product text in CSV exports", async () => {
    mocks.productFindMany.mockResolvedValueOnce([
      {
        name: "=HYPERLINK(\"https://example.test\")",
        variant: "",
        brand: "",
        category: "",
        ean: "",
        defaultPriceCents: null,
        size: "",
        imageUrls: [],
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/export/produkte?format=csv"),
      { params: Promise.resolve({ table: "produkte" }) }
    );

    expect(await response.text()).toContain("'=HYPERLINK");
  });

  it("keeps the product header row when the active filters return no rows", async () => {
    mocks.productFindMany.mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost/api/export/produkte?format=csv&q=missing"),
      { params: Promise.resolve({ table: "produkte" }) }
    );

    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv).toContain("Name;Variante;Marke;Kategorie;EAN");
  });

  it("requires narrower filters instead of buffering an unbounded catalog", async () => {
    mocks.productFindMany.mockResolvedValueOnce(
      Array.from({ length: 10_001 }, () => ({
        name: "Produkt",
        variant: null,
        brand: null,
        category: null,
        ean: null,
        defaultPriceCents: null,
        size: null,
        imageUrls: [],
      }))
    );

    const response = await GET(
      new Request("http://localhost/api/export/produkte?format=csv"),
      { params: Promise.resolve({ table: "produkte" }) }
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/10000/) });
  });
});
