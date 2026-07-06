import type { DocumentKind, Prisma, PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// DocumentNumberService – zentrale Vergabe sichtbarer Dokumentnummern.
//
// Anforderungen (siehe docs/inventory-refactor-plan.md, Phase 1):
//   * getrennte Sequenz pro Organization, Jahr und Dokumentart,
//   * concurrency-safe (keine doppelten Nummern bei parallelen Requests),
//   * Nummernerzeugung in EINER Datenbanktransaktion,
//   * sichtbare Nummer ist KEIN Primary Key (steht in inventory_number /
//     purchase_number / order_number etc.).
//
// Umsetzung: Prisma-Upsert mit atomarem `increment` erzeugt in Postgres ein
//   INSERT INTO document_sequences (...) VALUES (...)
//   ON CONFLICT ("organization_id","kind","year") DO UPDATE
//     SET "value" = document_sequences."value" + 1
//   RETURNING "value";
// Das ist row-level atomar und kollisionsfrei – zwei parallele Aufrufe für
// dieselbe (org, kind, year) bekommen garantiert unterschiedliche Werte.
// ---------------------------------------------------------------------------

/** Nummernpräfixe je Dokumentart. */
export const DOCUMENT_PREFIXES: Record<DocumentKind, string> = {
  OWNED_STOCK: "L",
  CONSIGNMENT: "K",
  PURCHASE: "E",
  SALE: "V",
  RETURN: "R",
  DEBT: "SCH",
};

/** Breite des Zählers im formatierten String (0-Padding). */
export const DOCUMENT_NUMBER_PAD = 4;

export interface DocumentNumberOptions {
  /** Bezugszeitpunkt für Jahr und Formatierung (Default: jetzt). */
  reference?: Date;
  /** Bereits laufende Prisma-Transaktion (wird bevorzugt genutzt). */
  tx?: Prisma.TransactionClient;
  /** Prisma-Client für stand-alone Aufrufe (öffnet eigene Transaktion). */
  prisma?: PrismaClient;
}

/**
 * Reserviert die nächste Nummer für (organizationId, kind, jahr) und liefert
 * die formatierte Anzeige (z. B. "L-26-0001") plus den rohen Zähler zurück.
 *
 * Wird typischerweise INNERHALB einer schon geöffneten `$transaction` (via
 * `tx`) aufgerufen, damit die Nummer im gleichen Commit landet wie der
 * fachliche Datensatz. Für Einzeltests oder einfache Server-Actions geht auch
 * der stand-alone Modus über `prisma`.
 */
export async function reserveDocumentNumber(
  organizationId: string,
  kind: DocumentKind,
  options: DocumentNumberOptions = {}
): Promise<{ display: string; value: number; year: number; prefix: string }> {
  if (!organizationId) throw new Error("organizationId ist erforderlich.");

  const reference = options.reference ?? new Date();
  const year = reference.getFullYear();
  const prefix = DOCUMENT_PREFIXES[kind];

  const runner = options.tx ?? options.prisma;
  if (!runner) {
    throw new Error(
      "reserveDocumentNumber: entweder 'tx' oder 'prisma' muss übergeben werden."
    );
  }

  const row = await runner.documentSequence.upsert({
    where: { organizationId_kind_year: { organizationId, kind, year } },
    create: { organizationId, kind, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return {
    display: formatDocumentNumber(prefix, year, row.value),
    value: row.value,
    year,
    prefix,
  };
}

/** Formatiert eine Nummer: `<PREFIX>-<JJ>-<NNNN>`. */
export function formatDocumentNumber(
  prefix: string,
  year: number,
  value: number
): string {
  return `${prefix}-${String(year).slice(-2)}-${String(value).padStart(
    DOCUMENT_NUMBER_PAD,
    "0"
  )}`;
}

/** Liest den zuletzt vergebenen Zähler ohne ihn zu erhöhen (Peek). */
export async function peekDocumentNumber(
  organizationId: string,
  kind: DocumentKind,
  options: { reference?: Date; prisma: PrismaClient }
): Promise<{ display: string; value: number } | null> {
  const year = (options.reference ?? new Date()).getFullYear();
  const row = await options.prisma.documentSequence.findUnique({
    where: { organizationId_kind_year: { organizationId, kind, year } },
    select: { value: true },
  });
  if (!row || row.value === 0) return null;
  return {
    display: formatDocumentNumber(DOCUMENT_PREFIXES[kind], year, row.value),
    value: row.value,
  };
}
