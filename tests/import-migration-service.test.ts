import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { IMPORT_TABLES, detectHeaderRowIndex } from "@/lib/import-export";
import {
  parseLegacyReferences,
  runMigrationImport,
  stockGroupingKey,
  type ImportRow,
} from "@/lib/services/import-migration-service";

function dryRunTx(options: {
  existingHashes?: string[];
  inventoryRefs?: Array<{
    legacyReference: string;
    targetEntityId: string;
    quantityAvailable?: number;
    inventoryType?: "OWNED" | "CONSIGNMENT";
  }>;
  saleRefs?: Array<{ legacyReference: string; targetEntityId: string }>;
  products?: Array<{ id: string; name: string; variant: string | null }>;
} = {}) {
  const existing = new Set(options.existingHashes ?? []);
  const sourceReferences = [
    ...(options.inventoryRefs ?? []).map((ref) => ({
      ...ref,
      rowHash: "inventory-row",
      targetEntity: "INVENTORY_POSITION",
    })),
    ...(options.saleRefs ?? []).map((ref) => ({
      ...ref,
      rowHash: "sale-row",
      targetEntity: "SALE",
    })),
  ];
  const tx = {
    sourceReference: {
      findMany: async (args: unknown) => {
        const where = asRecord(asRecord(args).where);
        if (where.rowHash) {
          const rowHash = asRecord(where.rowHash);
          const hashes = Array.isArray(rowHash.in) ? rowHash.in.map(String) : [];
          return hashes.filter((hash) => existing.has(hash)).map((rowHash) => ({ rowHash }));
        }
        if (where.targetEntity === "INVENTORY_POSITION") {
          return sourceReferences.filter((ref) => ref.targetEntity === "INVENTORY_POSITION");
        }
        if (where.targetEntity === "SALE") {
          return sourceReferences.filter((ref) => ref.targetEntity === "SALE");
        }
        return [];
      },
    },
    inventoryPosition: {
      findMany: async () =>
        (options.inventoryRefs ?? []).map((ref) => ({
          id: ref.targetEntityId,
          inventoryNumber: ref.legacyReference,
          inventoryType: ref.inventoryType ?? "OWNED",
          quantityAvailable: ref.quantityAvailable ?? 1,
          ownedLot: { unitPriceNet: "30.00" },
          consignmentLot: null,
        })),
    },
    product: {
      findMany: async () => options.products ?? [],
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

async function dryRun(table: Parameters<typeof runMigrationImport>[0]["table"], rows: ImportRow[], tx = dryRunTx()) {
  return runMigrationImport({
    tx,
    organizationId: "org-a",
    createdById: "user-a",
    table,
    rows,
    dryRun: true,
    allowConsignment: true,
    metadata: { fileName: `${table}.xlsx`, fileHash: `${table}-hash`, sheetName: "Sheet1" },
  });
}

describe("import migration pipeline", () => {
  it("parst Einzelreferenzen, & und Bereiche", () => {
    expect(parseLegacyReferences("L-26-600 & L-26-601")).toEqual(["L-26-600", "L-26-601"]);
    expect(parseLegacyReferences("L-26-594 - L-26-596")).toEqual(["L-26-594", "L-26-595", "L-26-596"]);
    expect(parseLegacyReferences("L-26-137 bis L-26-139")).toEqual(["L-26-137", "L-26-138", "L-26-139"]);
    expect(parseLegacyReferences("-")).toEqual([]);
  });

  it("gruppiert gleiche Lager-Einzelzeilen, aber trennt unterschiedliche EK-Preise", () => {
    const base = {
      model: "Fire TV Stick",
      colorway: "4K",
      size: "",
      ean: "123",
      haendler: "Amazon",
      datum: "01.01.2026",
      brutto: "29,99",
      netto: "29,99",
      vst: "nein",
      zm: "Firma",
      kauf: "O",
      retoure: "NN",
      status: "Gelagert",
    };
    expect(stockGroupingKey(base)).toBe(stockGroupingKey({ ...base, lagerid: "L-26-101" }));
    expect(stockGroupingKey(base)).not.toBe(stockGroupingKey({ ...base, brutto: "39,99" }));
  });

  it("erkennt Pattfield-Header mit Offset", () => {
    const rows = [
      ["Pattfield Report", "", ""],
      ["Stand", "08.07.2026", ""],
      ["Nr.", "Bezeichnung", "MM Stk.", "Restlager"],
      ["1", "Artikel", "20", "15"],
    ];
    expect(detectHeaderRowIndex(IMPORT_TABLES.konsignation.fields, rows)).toBe(2);
  });

  it("erkennt Pattfield-Schreibweise Indifikationsnr.", () => {
    const identificationField = IMPORT_TABLES.konsignation.fields.find((field) => field.key === "identifikationsnr");
    expect(identificationField?.aliases).toContain("indifikationsnr.");
  });

  it("erkennt Marke als Konsignationsspalte", () => {
    const brandField = IMPORT_TABLES.konsignation.fields.find((field) => field.key === "marke");
    expect(brandField?.aliases).toContain("brand");
  });

  it("Dry Run: Lager ohne Legacy-ID wird als neu geplant", async () => {
    const result = await dryRun("lager", [{
      model: "Fire TV Stick",
      brutto: "29,99",
      datum: "01.01.2026",
      zm: "Firma",
    }]);
    expect(result.summary.newRows).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("Dry Run: neues Katalogprodukt wird über die bestehende Pipeline geplant", async () => {
    const result = await dryRun("produkte", [{
      name: "Fire TV Stick",
      variant: "4K Max",
      brand: "Amazon",
      category: "Elektronik",
      standard_ek: "34,99",
    }]);

    expect(result.validCount).toBe(1);
    expect(result.summary.newRows).toBe(1);
    expect(result.summary.targetCounts.PRODUCT).toBe(1);
  });

  it("Dry Run: vorhandenes Katalogprodukt wird als Konflikt statt als Duplikat markiert", async () => {
    const result = await dryRun(
      "produkte",
      [{ name: "Fire TV Stick", variant: "4K Max" }],
      dryRunTx({ products: [{ id: "p1", name: "Fire TV Stick", variant: "4K Max" }] })
    );

    expect(result.validCount).toBe(0);
    expect(result.summary.conflicts).toBe(1);
    expect(result.summary.review[0].message).toMatch(/existiert bereits/);
  });

  it("Dry Run: doppelte Produktidentität in einer Datei wird als Konflikt markiert", async () => {
    const result = await dryRun("produkte", [
      { name: "Fire TV Stick", variant: "4K Max" },
      { name: " fire tv stick ", variant: "4k max" },
    ]);

    expect(result.validCount).toBe(1);
    expect(result.summary.conflicts).toBe(1);
    expect(result.summary.review).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 2, status: "CONFLICT" }),
      ])
    );
  });

  it.each([
    [{ variant: "4K Max" }, /Name fehlt/],
    [{ name: "Fire TV Stick", ean: "84A" }, /EAN/],
    [{ name: "Fire TV Stick", standard_ek: "teuer" }, /Standard-EK/],
    [{ name: "Fire TV Stick", bilder: "http://example.test/image.jpg" }, /HTTPS/],
    [{ name: "x".repeat(301) }, /300 Zeichen/],
  ])("Dry Run: ungültige Produktzeile bleibt fehlerhaft", async (row, message) => {
    const result = await dryRun("produkte", [row]);

    expect(result.validCount).toBe(0);
    expect(result.summary.errors).toBe(1);
    expect(result.errors[0]?.message).toMatch(message);
  });

  it("Dry Run: Verkauf ohne Lagerreferenz bleibt unresolved", async () => {
    const result = await dryRun("verkauf", [{
      orderid: "OLD-1",
      model: "Fire TV Stick",
      vk_brutto: "59,99",
    }]);
    expect(result.summary.unresolved).toBe(1);
  });

  it("Dry Run: Pattfield-Mengen nutzen Restlager plus historische Buckets", async () => {
    const result = await dryRun("konsignation", [{
      nr: "1",
      bezeichnung: "PE-12VB",
      name: "12V Ersatzakku",
      mm_stk: "33",
      lager: "12",
      verkauft: "1",
      retoure: "1",
      defekt: "12",
      restlager: "0",
      ek_brutto: "5,28 €",
      ek_netto: "4,44 €",
    }]);

    expect(result.validCount).toBe(1);
    expect(result.summary.newRows).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("Dry Run: Pattfield-Nullbestandszeilen werden übersprungen statt Import-Crash", async () => {
    const result = await dryRun("konsignation", [{
      nr: "8",
      bezeichnung: "PE-AHE 20 Li",
      name: "Pattfield A Hochentast.",
      mm_stk: "15",
      lager: "0",
      verkauft: "0",
      retoure: "0",
      defekt: "0",
      restlager: "0",
    }]);

    expect(result.validCount).toBe(0);
    expect(result.summary.errors).toBe(1);
    expect(result.errors[0].message).toMatch(/Keine importierbare/);
  });

  it("Dry Run: Verkauf mit eindeutiger Legacy-Lagerreferenz wird linked", async () => {
    const result = await dryRun("verkauf", [{
      orderid: "OLD-2",
      lagerids: "L-26-100",
      model: "Fire TV Stick",
      vk_brutto: "59,99",
    }], dryRunTx({
      inventoryRefs: [{ legacyReference: "L-26-100", targetEntityId: "inv-1" }],
    }));
    expect(result.summary.linked).toBe(1);
  });

  it("Dry Run: Verkauf darf ohne Add-on keinen Konsignationsbestand zuordnen", async () => {
    const tx = dryRunTx({
      inventoryRefs: [
        {
          legacyReference: "K-26-100",
          targetEntityId: "consignment-1",
          inventoryType: "CONSIGNMENT",
        },
      ],
    });
    const result = await runMigrationImport({
      tx,
      organizationId: "org-a",
      createdById: "user-a",
      table: "verkauf",
      rows: [
        {
          orderid: "OLD-K-1",
          lagerids: "K-26-100",
          model: "Konsignationsartikel",
          vk_brutto: "59,99",
        },
      ],
      dryRun: true,
      allowConsignment: false,
    });

    expect(result.summary.linked).toBe(0);
    expect(result.summary.unresolved).toBe(1);
  });

  it("Dry Run: Verkauf mit kumulierter Überbuchung braucht Review", async () => {
    const result = await dryRun("verkauf", [
      {
        orderid: "OLD-5",
        lagerids: "L-26-200",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
      {
        orderid: "OLD-6",
        lagerids: "L-26-200",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
    ], dryRunTx({
      inventoryRefs: [{ legacyReference: "L-26-200", targetEntityId: "inv-200", quantityAvailable: 1 }],
    }));

    expect(result.validCount).toBe(1);
    expect(result.summary.linked).toBe(1);
    expect(result.summary.reviewRequired).toBe(1);
    expect(result.summary.review[1].message).toMatch(/Review nötig/);
  });

  it("Dry Run: Review-Verkauf kann historisch ohne Bestand freigegeben werden", async () => {
    const result = await dryRun("verkauf", [
      {
        orderid: "OLD-7",
        lagerids: "L-26-201",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
      {
        orderid: "OLD-8",
        lagerids: "L-26-201",
        import_resolution: "historical",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
    ], dryRunTx({
      inventoryRefs: [{ legacyReference: "L-26-201", targetEntityId: "inv-201", quantityAvailable: 1 }],
    }));

    expect(result.validCount).toBe(2);
    expect(result.summary.linked).toBe(1);
    expect(result.summary.unresolved).toBe(1);
    expect(result.summary.reviewRequired).toBe(0);
  });

  it("Dry Run: Review-Verkauf kann auf Ersatzbestand umgebucht werden", async () => {
    const result = await dryRun("verkauf", [
      {
        orderid: "OLD-9",
        lagerids: "L-26-202",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
      {
        orderid: "OLD-10",
        lagerids: "L-26-202",
        resolved_lagerids: "L-26-203",
        model: "Fire TV Stick",
        vk_brutto: "59,99",
      },
    ], dryRunTx({
      inventoryRefs: [
        { legacyReference: "L-26-202", targetEntityId: "inv-202", quantityAvailable: 1 },
        { legacyReference: "L-26-203", targetEntityId: "inv-203", quantityAvailable: 1 },
      ],
    }));

    expect(result.validCount).toBe(2);
    expect(result.summary.linked).toBe(2);
    expect(result.summary.reviewRequired).toBe(0);
  });

  it("Dry Run: Retoure mit Order-Referenz wird teilweise verknüpft", async () => {
    const result = await dryRun("retouren", [{
      orderid: "OLD-2",
      erstattung: "59,99",
    }], dryRunTx({
      saleRefs: [{ legacyReference: "OLD-2", targetEntityId: "sale-1" }],
    }));
    expect(result.summary.partiallyLinked).toBe(1);
  });

  it("Dry Run: wiederholter Import markiert bekannte Zeilen als unverändert", async () => {
    const first = await dryRun("verkauf", [{ orderid: "OLD-3", vk_brutto: "10,00" }]);
    const rowHash = first.summary.review[0].status === "UNRESOLVED"
      ? first.summary.review[0].legacyReference
      : "";
    expect(rowHash).toBe("OLD-3");

    const result = await dryRun("verkauf", [{ orderid: "OLD-3", vk_brutto: "10,00" }], {
      ...dryRunTx(),
      sourceReference: {
        findMany: async (args: unknown) => {
          const rowHashArgs = asRecord(asRecord(asRecord(args).where).rowHash);
          const hashes = Array.isArray(rowHashArgs.in) ? rowHashArgs.in.map(String) : [];
          return hashes.map((hash) => ({ rowHash: hash }));
        },
      },
    } as unknown as Prisma.TransactionClient);
    expect(result.summary.unchanged).toBe(1);
  });

  it("Dry Run: Organisation B sieht Mapping von Organisation A nicht", async () => {
    const result = await runMigrationImport({
      tx: dryRunTx(),
      organizationId: "org-b",
      createdById: "user-b",
      table: "verkauf",
      rows: [{ orderid: "OLD-4", lagerids: "L-26-100", vk_brutto: "10,00" }],
      dryRun: true,
      allowConsignment: true,
    });
    expect(result.summary.unresolved).toBe(1);
  });

  it("Dry Run: Schuld mit Mehrfachreferenz braucht Review ohne Betrag zu vervielfachen", async () => {
    const result = await dryRun("schulden", [{
      refid: "L-26-600 & L-26-601",
      beschreibung: "Ausgleich",
      betrag: "100,00",
      schuldner: "GbR",
      empfaenger: "Richard",
    }]);
    expect(result.summary.reviewRequired).toBe(1);
    expect(result.summary.review[0].warnings?.[0]).toMatch(/Gesamtbetrag/);
  });
});
