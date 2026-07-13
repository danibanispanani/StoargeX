import type { DocumentKind } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DOCUMENT_PREFIXES,
  formatDocumentNumber,
  reserveDocumentNumber,
} from "@/lib/services/document-number-service";

// Unit-Tests laufen ohne echte Datenbank. Wir mocken die von Prisma erwartete
// upsert-Semantik so, wie sie in Postgres tatsächlich implementiert ist:
// `INSERT ... ON CONFLICT DO UPDATE SET value = value + 1 RETURNING value` –
// atomar pro (org, kind, year). Der Mock spiegelt genau diese Semantik.

type Key = string;

function keyOf(organizationId: string, kind: DocumentKind, year: number): Key {
  return `${organizationId}|${kind}|${year}`;
}

interface StoredRow {
  value: number;
}

function makeStore() {
  const rows = new Map<Key, StoredRow>();
  return {
    rows,
    documentSequence: {
      async upsert(args: {
        where: {
          organizationId_kind_year: {
            organizationId: string;
            kind: DocumentKind;
            year: number;
          };
        };
        create: { value: number };
        update: { value: { increment: number } };
        select: { value: true };
      }) {
        const { organizationId, kind, year } = args.where.organizationId_kind_year;
        const key = keyOf(organizationId, kind, year);
        const existing = rows.get(key);
        if (!existing) {
          const row: StoredRow = { value: args.create.value };
          rows.set(key, row);
          return { value: row.value };
        }
        existing.value += args.update.value.increment;
        return { value: existing.value };
      },
    },
  };
}

describe("formatDocumentNumber", () => {
  it("baut das Anzeigeformat <PREFIX>-<JJ>-<NNNN>", () => {
    expect(formatDocumentNumber("L", 2026, 1)).toBe("L-26-0001");
    expect(formatDocumentNumber("K", 2026, 42)).toBe("K-26-0042");
    expect(formatDocumentNumber("SCH", 2027, 999)).toBe("SCH-27-0999");
  });

  it("schneidet den Zähler nicht ab, wenn er breiter als 4 Stellen ist", () => {
    expect(formatDocumentNumber("V", 2026, 12345)).toBe("V-26-12345");
  });

  it("deckt alle Dokumentarten mit dem geforderten Präfix ab", () => {
    expect(DOCUMENT_PREFIXES).toEqual({
      OWNED_STOCK: "L",
      CONSIGNMENT: "K",
      PURCHASE: "E",
      SALE: "V",
      RETURN: "R",
      SUPPLIER_RETURN: "LR",
      DEBT: "SCH",
    });
  });
});

describe("reserveDocumentNumber", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it("erste Nummer je Organization/Jahr/Art startet bei 1", async () => {
    const result = await reserveDocumentNumber("org-a", "OWNED_STOCK", {
      reference: new Date(2026, 0, 15),
      tx: store as unknown as never,
    });
    expect(result).toEqual({
      display: "L-26-0001",
      value: 1,
      year: 2026,
      prefix: "L",
    });
  });

  it("Folgenummern zählen atomar hoch", async () => {
    const options = {
      reference: new Date(2026, 5, 1),
      tx: store as unknown as never,
    };
    const a = await reserveDocumentNumber("org-a", "SALE", options);
    const b = await reserveDocumentNumber("org-a", "SALE", options);
    const c = await reserveDocumentNumber("org-a", "SALE", options);
    expect([a.display, b.display, c.display]).toEqual([
      "V-26-0001",
      "V-26-0002",
      "V-26-0003",
    ]);
  });

  it("Jahreswechsel startet einen neuen Zähler bei 1", async () => {
    const opts2026 = {
      reference: new Date(2026, 11, 31),
      tx: store as unknown as never,
    };
    const opts2027 = {
      reference: new Date(2027, 0, 1),
      tx: store as unknown as never,
    };
    const last2026 = await reserveDocumentNumber("org-a", "PURCHASE", opts2026);
    const first2027 = await reserveDocumentNumber("org-a", "PURCHASE", opts2027);
    const second2027 = await reserveDocumentNumber("org-a", "PURCHASE", opts2027);
    expect(last2026.display).toBe("E-26-0001");
    expect(first2027.display).toBe("E-27-0001");
    expect(second2027.display).toBe("E-27-0002");
  });

  it("unterschiedliche Organisationen haben eigene Zähler", async () => {
    const options = {
      reference: new Date(2026, 2, 10),
      tx: store as unknown as never,
    };
    const a1 = await reserveDocumentNumber("org-a", "RETURN", options);
    const a2 = await reserveDocumentNumber("org-a", "RETURN", options);
    const b1 = await reserveDocumentNumber("org-b", "RETURN", options);
    expect(a1.display).toBe("R-26-0001");
    expect(a2.display).toBe("R-26-0002");
    expect(b1.display).toBe("R-26-0001");
  });

  it("unterschiedliche Dokumentarten haben unabhängige Zähler", async () => {
    const options = {
      reference: new Date(2026, 0, 1),
      tx: store as unknown as never,
    };
    const lot = await reserveDocumentNumber("org-a", "OWNED_STOCK", options);
    const kons = await reserveDocumentNumber("org-a", "CONSIGNMENT", options);
    const einkauf = await reserveDocumentNumber("org-a", "PURCHASE", options);
    const debt = await reserveDocumentNumber("org-a", "DEBT", options);
    expect([lot.display, kons.display, einkauf.display, debt.display]).toEqual([
      "L-26-0001",
      "K-26-0001",
      "E-26-0001",
      "SCH-26-0001",
    ]);
  });

  it("simulierte parallele Erzeugung: keine doppelten Nummern", async () => {
    // Parallel abgesetzte Reservationen dürfen nicht kollidieren.
    // Der Mock spiegelt das Postgres-Verhalten von upsert+increment: die
    // sequenziell durchlaufende Ausführung im gleichen Store liefert eine
    // lückenlose, injektive Folge. Diese Invariante prüfen wir hier.
    const options = {
      reference: new Date(2026, 4, 20),
      tx: store as unknown as never,
    };
    const jobs = Array.from({ length: 20 }, () =>
      reserveDocumentNumber("org-x", "SALE", options)
    );
    const results = await Promise.all(jobs);
    const values = results.map((r) => r.value);
    const displays = results.map((r) => r.display);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(displays).size).toBe(displays.length);
    // lückenlose 1..20 (Reihenfolge unabhängig)
    expect([...values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
  });

  it("wirft ohne tx/prisma-Runner", async () => {
    await expect(
      reserveDocumentNumber("org-a", "SALE", { reference: new Date(2026, 0, 1) })
    ).rejects.toThrow();
  });

  it("wirft ohne organizationId", async () => {
    await expect(
      reserveDocumentNumber("", "SALE", {
        reference: new Date(2026, 0, 1),
        tx: store as unknown as never,
      })
    ).rejects.toThrow();
  });
});
