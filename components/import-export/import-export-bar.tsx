"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getImportInventoryOptionsAction,
  importRowsAction,
  type ImportInventoryOption,
  type ImportResult,
} from "@/lib/actions/import";
import {
  autoMapColumns,
  decodeSpreadsheetSafeText,
  detectHeaderRowIndex,
  IMPORT_TABLES,
  hasBlockingImportReview,
  type TableKey,
} from "@/lib/import-export";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="flex flex-wrap gap-1.5">
      <TemplateDialog table={table} />
      <ExportDownloadButton url={exportUrl("csv")} label="Export CSV" />
      <ExportDownloadButton url={exportUrl("xlsx")} label="Export Excel" />
      <ImportDialog table={table} />
    </div>
  );
}

function ExportDownloadButton({ url, label }: { url: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  function download() {
    startTransition(async () => {
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          if (controller.signal.aborted) return;
          toast.error(payload?.error ?? "Export fehlgeschlagen.");
          return;
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const disposition = response.headers.get("content-disposition") ?? "";
        link.href = blobUrl;
        link.download = disposition.match(/filename="([^"]+)"/)?.[1] ?? "storagex-export";
        link.click();
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("Export fehlgeschlagen. Bitte Verbindung prüfen.");
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download} disabled={pending}>
      <DownloadIcon /> {pending ? "Exportiert…" : label}
    </Button>
  );
}

function TemplateDialog({ table }: { table: TableKey }) {
  const def = IMPORT_TABLES[table];
  const downloadUrl = (format: "csv" | "xlsx", kind: "empty" | "example") =>
    `/api/import-template/${table}?format=${format}&kind=${kind}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheetIcon /> Vorlage herunterladen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{def.label}: Importvorlage</DialogTitle>
          <DialogDescription>
            Leere oder ausgefüllte Vorlage herunterladen. XLSX enthält zusätzlich die Spaltenbeschreibung.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["empty", "example"] as const).map((kind) => (
            <div key={kind} className="space-y-2 border p-3">
              <div>
                <p className="font-medium">{kind === "empty" ? "Leere Vorlage" : "Beispielvorlage"}</p>
                <p className="text-xs text-muted-foreground">
                  {kind === "empty" ? "Nur freigegebene Spaltenköpfe." : "Mit einer korrekt formatierten Beispielzeile."}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button asChild variant="secondary" size="sm">
                  <a href={downloadUrl("csv", kind)} download><DownloadIcon /> CSV</a>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <a href={downloadUrl("xlsx", kind)} download><DownloadIcon /> XLSX</a>
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto border">
          <table className="w-full min-w-[42rem] text-left text-xs">
            <thead className="bg-muted/70">
              <tr>
                <th className="p-2">Spalte</th>
                <th className="p-2">Pflicht</th>
                <th className="p-2">Format</th>
                <th className="p-2">Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              {def.fields.map((field) => (
                <tr key={field.key} className="border-t align-top">
                  <td className="p-2 font-medium">{field.label}</td>
                  <td className="p-2">{field.required ? "Ja" : "Nein"}</td>
                  <td className="p-2 font-mono">{field.format ?? "Text"}</td>
                  <td className="p-2 text-muted-foreground">{field.description ?? `${field.label} gemäß Moduldefinition.`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
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
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [reviewResolutions, setReviewResolutions] = useState<Record<number, ReviewResolution>>({});
  const [inventoryOptions, setInventoryOptions] = useState<ImportInventoryOption[]>([]);
  const [consignmentPartnerFallback, setConsignmentPartnerFallback] = useState("");
  const [pending, startTransition] = useTransition();
  const revisionRef = useRef(0);
  const loadIdRef = useRef(0);

  function invalidateDryRun() {
    revisionRef.current += 1;
    setCheckResult(null);
  }

  function reset() {
    loadIdRef.current += 1;
    revisionRef.current += 1;
    setFileName("");
    setFileHash("");
    setSheetName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setCheckResult(null);
    setImportMessage(null);
    setReviewResolutions({});
    setInventoryOptions([]);
    setConsignmentPartnerFallback("");
  }

  async function handleFile(file: File) {
    const loadId = ++loadIdRef.current;
    try {
      const buffer = await file.arrayBuffer();
      if (loadId !== loadIdRef.current) return;
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
      if (loadId !== loadIdRef.current) return;
      const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      setFileName(file.name);
      setFileHash(hash);
      setSheetName(selectedSheetName);
      setHeaders(fileHeaders);
      setRawRows(json);
      setMapping(autoMapColumns(def.fields, fileHeaders));
      invalidateDryRun();
      setImportMessage(null);
      setReviewResolutions({});
    } catch {
      toast.error("Datei konnte nicht gelesen werden (CSV oder .xlsx erwartet).");
    }
  }

  function buildMappedRows(): Record<string, string>[] {
    return rawRows.map((raw, index) => {
      const row: Record<string, string> = {};
      for (const field of def.fields) {
        const column = mapping[field.key];
        row[field.key] = column
          ? decodeSpreadsheetSafeText(String(raw[column] ?? "").trim())
          : "";
      }
      const resolution = reviewResolutions[index + 1];
      if (resolution?.mode === "historical") {
        row.import_resolution = "historical";
      }
      if (resolution?.mode === "inventory" && resolution.inventoryNumber) {
        row.resolved_lagerids = resolution.inventoryNumber;
      }
      if (table === "konsignation" && !row.partner.trim()) {
        row.default_partner = consignmentPartnerFallback.trim() || "Unbekannt";
      }
      return row;
    });
  }

  function metadata() {
    return { fileName, fileHash, sheetName };
  }

  function runCheck() {
    const revision = revisionRef.current;
    const mappedRows = buildMappedRows();
    const importMetadata = metadata();
    startTransition(async () => {
      setImportMessage(null);
      const result = await importRowsAction(table, mappedRows, true, importMetadata);
      if (revision !== revisionRef.current) return;
      if (result.error) toast.error(result.error);
      setCheckResult(result);
      if (table === "verkauf" && hasBlockingReview(result) && inventoryOptions.length === 0) {
        const options = await getImportInventoryOptionsAction();
        if (revision !== revisionRef.current) return;
        setInventoryOptions(options);
      }
    });
  }

  function runImport() {
    const revision = revisionRef.current;
    const mappedRows = buildMappedRows();
    const importMetadata = metadata();
    startTransition(async () => {
      setImportMessage(null);
      const result = await importRowsAction(table, mappedRows, false, importMetadata);
      if (revision !== revisionRef.current) return;
      if (result.error) {
        setCheckResult(result);
        setImportMessage(result.error);
        toast.error(result.error);
        return;
      }
      if ((result.importedCount ?? 0) === 0) {
        setCheckResult(result);
        const message = hasBlockingReview(result)
          ? "Import gestoppt: Erst Review-/Konfliktzeilen entscheiden."
          : "Es wurden keine neuen Zeilen importiert.";
        setImportMessage(message);
        toast.warning(message);
        return;
      }
      toast.success(`${result.importedCount ?? 0} Zeilen in ${def.label} importiert ✓`);
      if (result.warning) toast.warning(result.warning);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
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
              disabled={pending}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                {fileName} · {sheetName} · {rawRows.length} Zeilen · {headers.length} Spalten
              </p>
            )}
          </div>

          {table === "konsignation" && rawRows.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <label htmlFor="consignment-partner-fallback" className="text-sm font-medium">
                Partner-Fallback
              </label>
              <Input
                id="consignment-partner-fallback"
                value={consignmentPartnerFallback}
                onChange={(event) => {
                  setConsignmentPartnerFallback(event.target.value);
                  invalidateDryRun();
                }}
                disabled={pending}
                placeholder="z.B. MixMarkt; leer = Unbekannt"
              />
              <p className="text-xs text-muted-foreground">
                Wird nur fÃ¼r Zeilen verwendet, in denen die Partner-Spalte leer ist.
              </p>
            </div>
          )}

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
                        invalidateDryRun();
                      }}
                      disabled={pending}
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
              <MappingPreview fields={def.fields} rows={rawRows} mapping={mapping} />
            </div>
          )}

          {checkResult && !checkResult.error && (
            <div className="space-y-2">
              <Alert variant={checkResult.errors.length || hasBlockingReview(checkResult) ? "destructive" : "default"}>
                <AlertDescription>
                  {checkResult.validCount} von {rawRows.length} Zeilen importierbar
                  {checkResult.errors.length > 0 &&
                    ` · ${checkResult.errors.length} Fehler`}
                  {hasBlockingReview(checkResult) &&
                    " · Review erforderlich"}
                </AlertDescription>
              </Alert>
              {checkResult.summary && <ImportSummaryView result={checkResult} />}
              {hasBlockingReview(checkResult) && table === "verkauf" ? (
                <ImportReviewControls
                  result={checkResult}
                  resolutions={reviewResolutions}
                  inventoryOptions={inventoryOptions}
                  onResolve={(row, resolution) => {
                    revisionRef.current += 1;
                    setReviewResolutions((current) => ({ ...current, [row]: resolution }));
                    setImportMessage("Review-Entscheidung geändert. Bitte Dry Run erneut prüfen.");
                  }}
                />
              ) : hasBlockingReview(checkResult) ? (
                <ImportConflictList result={checkResult} />
              ) : null}
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

          {importMessage && (
            <Alert variant="destructive">
              <AlertDescription>{importMessage}</AlertDescription>
            </Alert>
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
                pending ||
                !checkResult ||
                !!checkResult.error ||
                checkResult.validCount === 0 ||
                hasBlockingReview(checkResult)
              }
              onClick={runImport}
            >
              {pending
                ? "Importiert…"
                : hasBlockingReview(checkResult)
                  ? "Review erforderlich"
                  : `${checkResult?.validCount ?? 0} Zeilen importieren`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ReviewResolution =
  | { mode: "historical" }
  | { mode: "inventory"; inventoryNumber: string };

function hasBlockingReview(result: ImportResult | null) {
  return hasBlockingImportReview(result?.summary);
}

function ImportConflictList({ result }: { result: ImportResult }) {
  const items =
    result.summary?.review.filter(
      (item) => item.status === "REVIEW_REQUIRED" || item.status === "CONFLICT"
    ) ?? [];

  return (
    <div className="space-y-2 rounded-md border p-3 text-xs">
      <p className="font-medium">Konflikte in der Quelldatei beheben</p>
      <p className="text-muted-foreground">
        Bereinige die genannten Zeilen und starte danach einen neuen Dry Run.
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.row} className="rounded bg-muted/40 p-2">
            <span className="font-mono">Zeile {item.row}</span>: {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportReviewControls({
  result,
  resolutions,
  inventoryOptions,
  onResolve,
}: {
  result: ImportResult;
  resolutions: Record<number, ReviewResolution>;
  inventoryOptions: ImportInventoryOption[];
  onResolve: (row: number, resolution: ReviewResolution) => void;
}) {
  const reviewItems =
    result.summary?.review.filter((item) => item.status === "REVIEW_REQUIRED" || item.status === "CONFLICT") ?? [];

  if (reviewItems.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border p-3 text-xs">
      <div>
        <p className="font-medium">Review-Entscheidung</p>
        <p className="text-muted-foreground">
          Wähle pro Zeile entweder historischen Import ohne Bestandsabbuchung oder eine verfügbare Ersatzposition.
          Danach den Dry Run erneut prüfen.
        </p>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {reviewItems.map((item) => {
          const resolution = resolutions[item.row];
          return (
            <div key={item.row} className="grid gap-2 rounded-md bg-muted/40 p-2 md:grid-cols-[7rem_1fr_14rem] md:items-center">
              <div className="font-mono">Zeile {item.row}</div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.legacyReference ?? "ohne Referenz"}</p>
                <p className="text-muted-foreground">{item.message}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant={resolution?.mode === "historical" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onResolve(item.row, { mode: "historical" })}
                >
                  Ohne Bestand importieren
                </Button>
                <Select
                  value={resolution?.mode === "inventory" ? resolution.inventoryNumber : ""}
                  onValueChange={(inventoryNumber) => onResolve(item.row, { mode: "inventory", inventoryNumber })}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Ersatzbestand wählen" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[32rem]">
                    {inventoryOptions.map((option) => (
                      <SelectItem key={option.inventoryNumber} value={option.inventoryNumber}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

function MappingPreview({
  fields,
  rows,
  mapping,
}: {
  fields: (typeof IMPORT_TABLES)[TableKey]["fields"];
  rows: Record<string, unknown>[];
  mapping: Record<string, string | null>;
}) {
  const mappedFields = fields.filter((field) => mapping[field.key]);
  if (mappedFields.length === 0 || rows.length === 0) return null;
  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium">Mapping-Vorschau · erste {Math.min(3, rows.length)} Zeilen</p>
      <div className="overflow-x-auto border">
        <table className="min-w-max text-left text-xs">
          <thead className="bg-muted/60">
            <tr>{mappedFields.map((field) => <th key={field.key} className="p-2">{field.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row, index) => (
              <tr key={index} className="border-t">
                {mappedFields.map((field) => (
                  <td key={field.key} className="max-w-52 truncate p-2">
                    {String(row[mapping[field.key]!] ?? "") || "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
