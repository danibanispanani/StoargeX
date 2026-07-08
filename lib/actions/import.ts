"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { IMPORT_TABLES, type TableKey } from "@/lib/import-export";
import {
  runMigrationImport,
  type ImportMetadata,
  type ImportSummary,
} from "@/lib/services/import-migration-service";

export interface ImportResult {
  validCount: number;
  errors: Array<{ row: number; message: string }>;
  importedCount?: number;
  batchId?: string;
  summary?: ImportSummary;
  error?: string;
}

type Row = Record<string, string>;

const requestSchema = z.object({
  table: z.enum(["lager", "verkauf", "retouren", "konsignation", "schulden", "aufgaben"]),
  dryRun: z.boolean(),
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, "Keine Zeilen gefunden.")
    .max(5000, "Maximal 5000 Zeilen pro Import."),
});

export async function importRowsAction(
  table: TableKey,
  rows: Row[],
  dryRun: boolean,
  metadata?: ImportMetadata
): Promise<ImportResult> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = requestSchema.safeParse({ table, dryRun, rows });
  if (!parsed.success) {
    return {
      validCount: 0,
      errors: [],
      error: parsed.error.issues[0]?.message ?? "Ungültige Anfrage.",
    };
  }

  const requiredFieldErrors = validateRequiredFields(parsed.data.table, parsed.data.rows);
  if (requiredFieldErrors.length > 0) {
    return {
      validCount: parsed.data.rows.length - new Set(requiredFieldErrors.map((error) => error.row)).size,
      errors: requiredFieldErrors.slice(0, 50),
      summary: {
        unchanged: 0,
        updateAvailable: 0,
        newRows: 0,
        conflicts: 0,
        linked: 0,
        partiallyLinked: 0,
        unresolved: 0,
        reviewRequired: 0,
        errors: requiredFieldErrors.length,
        targetCounts: {},
        review: requiredFieldErrors.map((error) => ({
          row: error.row,
          status: "ERROR",
          message: error.message,
          errors: [error.message],
        })),
      },
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
      return runMigrationImport({
        tx,
        organizationId: organization.id,
        createdById: userId,
        table: parsed.data.table,
        rows: parsed.data.rows,
        dryRun,
        metadata,
      });
    }, { maxWait: 30000, timeout: 600000 });

    if (!dryRun && (result.importedCount ?? 0) > 0) {
      await writeAuditLog({
        organizationId: organization.id,
        userId,
        action: "import.run",
        entityType: "ImportBatch",
        entityId: result.batchId,
        after: {
          table,
          importedCount: result.importedCount,
          summary: result.summary,
        } as unknown as Prisma.InputJsonValue,
      });
      revalidateImportViews(table);
    }

    void db;
    return result;
  } catch (error) {
    return {
      validCount: 0,
      errors: [],
      error: error instanceof Error ? error.message : "Import fehlgeschlagen.",
    };
  }
}

function validateRequiredFields(table: TableKey, rows: Row[]) {
  const fields = IMPORT_TABLES[table].fields;
  const errors: Array<{ row: number; message: string }> = [];
  rows.forEach((row, index) => {
    for (const field of fields) {
      if (field.required && !row[field.key]?.trim()) {
        errors.push({ row: index + 1, message: `${field.label} fehlt.` });
      }
    }
  });
  return errors;
}

function revalidateImportViews(table: TableKey) {
  revalidatePath(`/${table === "verkauf" ? "verkauf" : table}`);
  revalidatePath("/lager");
  revalidatePath("/schulden");
  revalidatePath("/konsignation");
  revalidatePath("/retouren");
  revalidatePath("/dashboard");
}
