"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import {
  FeatureAccessDeniedError,
  getFeatureAccess,
} from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  hasBlockingImportReview,
  IMPORT_TABLES,
  TABLE_KEYS,
  type TableKey,
} from "@/lib/import-export";
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
  warning?: string;
}

export interface ImportInventoryOption {
  inventoryNumber: string;
  label: string;
  quantityAvailable: number;
  inventoryType: "OWNED" | "CONSIGNMENT";
}

type Row = Record<string, string>;

const requestSchema = z.object({
  table: z.enum(TABLE_KEYS),
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
  const context = await requireOrg("MEMBER");
  const { db, organization, userId } = context;
  const consignmentAccess =
    table === "verkauf" || table === "konsignation"
      ? await getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT)
      : null;

  if (table === "konsignation" && !consignmentAccess?.enabled) {
    return {
      validCount: 0,
      errors: [],
      error: new FeatureAccessDeniedError(FEATURE_KEYS.CONSIGNMENT).message,
    };
  }

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

  let committedResult: Awaited<ReturnType<typeof runMigrationImport>> | null = null;
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
        allowConsignment: consignmentAccess?.enabled ?? false,
      });
    }, { maxWait: 30000, timeout: 600000 });
    committedResult = result;

    if (!dryRun && hasBlockingImportReview(result.summary)) {
      return {
        ...result,
        error: "Import gestoppt: Es gibt Review- oder Konfliktzeilen. Bitte zuerst prüfen.",
      };
    }

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
    if (committedResult) {
      revalidateImportViews(table);
      return {
        ...committedResult,
        warning: "Import abgeschlossen, aber eine nachgelagerte Protokollierung ist fehlgeschlagen.",
      };
    }
    if (!dryRun) {
      const failureMessage = error instanceof Error ? error.message : "Import fehlgeschlagen.";
      try {
        await db.importBatch.create({
          data: {
            organizationId: organization.id,
            fileName: metadata?.fileName || `${table}-import`,
            fileHash:
              metadata?.fileHash ||
              createHash("sha256")
                .update(JSON.stringify({ table: parsed.data.table, rows: parsed.data.rows }))
                .digest("hex"),
            importType: table,
            status: "FAILED",
            finishedAt: new Date(),
            createdById: userId,
            summary: { failure: failureMessage } as Prisma.InputJsonValue,
          },
        });
      } catch {
        // Der ursprüngliche Importfehler bleibt die relevante Rückmeldung.
      }
    }
    return {
      validCount: 0,
      errors: [],
      error: error instanceof Error ? error.message : "Import fehlgeschlagen.",
    };
  }
}

export async function getImportInventoryOptionsAction(): Promise<ImportInventoryOption[]> {
  const context = await requireOrg("MEMBER");
  const { db } = context;
  const consignmentAccess = await getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT);
  const positions = await db.inventoryPosition.findMany({
    where: {
      active: true,
      quantityAvailable: { gt: 0 },
      ...(consignmentAccess.enabled ? {} : { inventoryType: "OWNED" as const }),
    },
    orderBy: [
      { inventoryNumber: "asc" },
    ],
    take: 500,
    include: {
      product: {
        select: {
          name: true,
          variant: true,
          size: true,
        },
      },
      consignmentLot: {
        select: {
          partnerCompany: true,
        },
      },
    },
  });

  return positions.map((position) => {
    const productParts = [
      position.product.name,
      position.product.variant,
      position.product.size,
    ].filter(Boolean);
    const source =
      position.inventoryType === "CONSIGNMENT"
        ? `Konsignation${position.consignmentLot?.partnerCompany ? ` · ${position.consignmentLot.partnerCompany}` : ""}`
        : "Eigenbestand";

    return {
      inventoryNumber: position.inventoryNumber,
      label: `${position.inventoryNumber} · ${productParts.join(" · ")} · ${position.quantityAvailable} verfügbar · ${source}`,
      quantityAvailable: position.quantityAvailable,
      inventoryType: position.inventoryType,
    };
  });
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
  revalidatePath("/produkte");
  revalidatePath("/lager");
  revalidatePath("/schulden");
  revalidatePath("/konsignation");
  revalidatePath("/retouren");
  revalidatePath("/dashboard");
}
