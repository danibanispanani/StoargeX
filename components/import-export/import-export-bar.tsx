"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importRowsAction, type ImportResult } from "@/lib/actions/import";
import {
  autoMapColumns,
  detectHeaderRowIndex,
  IMPORT_TABLES,
  type TableKey,
} from "@/lib/import-export";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ImportExportBar({ table }: { table: TableKey }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  function exportUrl(format: "csv" | "xlsx") {
    return `/api/export/${table}?format=${format}${query ? `&${query}` : ""}`;
  }

  return (
    <div className="flex gap-1.5">
      <Button asChild variant="outline" size="sm">
        <a href={exportUrl("csv")} download>
          Export CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={exportUrl("xlsx")} download>
          Export Excel
        </a>
      </Button>
      <ImportDialog table={table} />
    </div>
  );
}

function ImportDialog({ table }: { table: TableKey }) {
  const router = useRouter();
  const def = IMPORT_TABLES[table];
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [checkResult, setCheckResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFileName("");
    setFileHash("");
    setSheetName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setCheckResult(null);
  }

  async function handleFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const workbook = isCsv
        ? XLSX.read(new TextDecoder().decode(buffer), { type: "string", cellDates: false })
        : XLSX.read(buffer, { cellDates: false });
      const selectedSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[selectedSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
      });
      const headerIndex = detectHeaderRowIndex(def.fields, matrix);
      const fileHeaders = (matrix[headerIndex] ?? [])
        .map((cell) => String(cell ?? "").trim())
        .filter(Boolean);
      const dataRows = matrix
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => String(cell ?? "").trim()));
      const json = dataRows.map((row) =>
        Object.fromEntries(
          fileHeaders.map((header, index) => [header, String(row[index] ?? "")])
        )
      );
      if (json.length === 0) {
        toast.error("Die Datei enthält keine Datenzeilen.");
        return;
      }
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      setFileName(file.name);
      setFileHash(hash);
      setSheetName(selectedSheetName);
      setHeaders(fileHeaders);
      setRawRows(json);
      setMapping(autoMapColumns(def.fields, fileHeaders));
      setCheckResult(null);
    } catch {
      toast.error("Datei konnte nicht gelesen werden (CSV oder .xlsx erwartet).");
    }
  }

  function buildMappedRows(): Record<string, string>[] {
    return rawRows.map((raw) => {
      const row: Record<string, string> = {};
      for (const field of def.fields) {
        const column = mapping[field.key];
        row[field.key] = column ? String(raw[column] ?? "").trim() : "";
      }
      return row;
    });
  }

  function metadata() {
    return { fileName, fileHash, sheetName };
  }

  function runCheck() {
    startTransition(async () => {
      const result = await importRowsAction(table, buildMappedRows(), true, metadata());
      if (result.error) toast.error(result.error);
      setCheckResult(result);
    });
  }

  function runImport() {
    startTransition(async () => {
      const result = await importRowsAction(table, buildMappedRows(), false, metadata());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.importedCount ?? 0} Zeilen in ${def.label} importiert ✓`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{def.label} importieren</DialogTitle>
          <DialogDescription>
            CSV oder Excel hochladen, Spalten zuordnen, Dry Run prüfen,
            anschließend migrationssicher importieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              aria-label="Import-Datei wählen"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                {fileName} · {sheetName} · {rawRows.length} Zeilen · {headers.length} Spalten
              </p>
            )}
          </div>

          {headers.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Spalten-Zuordnung</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {def.fields.map((field) => (
                  <label key={field.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </span>
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(event) => {
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: event.target.value || null,
                        }));
                        setCheckResult(null);
                      }}
                      className="border-input h-8 w-44 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="">– ignorieren –</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {checkResult && !checkResult.error && (
            <div className="space-y-2">
              <Alert variant={checkResult.errors.length ? "destructive" : "default"}>
                <AlertDescription>
                  {checkResult.validCount} von {rawRows.length} Zeilen gültig
                  {checkResult.errors.length > 0 &&
                    ` · ${checkResult.errors.length} Fehler`}
                </AlertDescription>
              </Alert>
              {checkResult.summary && <ImportSummaryView result={checkResult} />}
              {checkResult.errors.length > 0 && (
                <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs text-destructive">
                  {checkResult.errors.map((error, index) => (
                    <li key={index}>
                      Zeile {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pending || rawRows.length === 0}
              onClick={runCheck}
            >
              {pending ? "Prüft…" : "Dry Run prüfen"}
            </Button>
            <Button
              disabled={
                pending || !checkResult || !!checkResult.error || checkResult.validCount === 0
              }
              onClick={runImport}
            >
              {pending
                ? "Importiert…"
                : `${checkResult?.validCount ?? 0} gültige Zeilen importieren`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportSummaryView({ result }: { result: ImportResult }) {
  const summary = result.summary;
  if (!summary) return null;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 rounded-md border p-2 text-xs sm:grid-cols-4">
        <ImportStat label="Unverändert" value={summary.unchanged} />
        <ImportStat label="Neu" value={summary.newRows} />
        <ImportStat label="Verknüpft" value={summary.linked} />
        <ImportStat label="Teilweise" value={summary.partiallyLinked} />
        <ImportStat label="Ungeklärt" value={summary.unresolved} />
        <ImportStat label="Review" value={summary.reviewRequired} />
        <ImportStat label="Konflikte" value={summary.conflicts} />
        <ImportStat label="Fehler" value={summary.errors} />
      </div>
      <ul className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
        {summary.review.slice(0, 80).map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="w-16 shrink-0">Zeile {item.row}</span>
            <span className="w-32 shrink-0 font-mono">{item.status}</span>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted px-2 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}
