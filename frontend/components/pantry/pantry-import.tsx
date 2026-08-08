"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileUp, Upload } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import type { PantryItem } from "./pantry-manager";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { SectionCard } from "../ui/Card";
import ConfirmModal from "../ui/ConfirmModal";
import { SelectField, controlClassName } from "../ui/Field";

type ImportedRow = {
  lineNumber: number;
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: string | null;
  notes: string | null;
  warnings: string[];
};

type ImportedRowError = {
  lineNumber: number;
  message: string;
  raw: string;
};

type ImportResponse = {
  dryRun: boolean;
  mode: "append" | "replace";
  rows: ImportedRow[];
  errors: ImportedRowError[];
  importedCount: number;
  replacedCount: number;
  pantryItems?: PantryItem[];
};

type ImportMode = "append" | "replace";

type PantryImportProps = {
  onImported: (pantryItems: PantryItem[]) => void;
};

const exampleHeader = "Madvare,Mængde,Enhed,Udløbsdato,Noter";

/**
 * Bulk import of a cabinet stocktake written in a spreadsheet.
 *
 * Nothing is written until the parsed result has been shown: a stocktake is
 * thirty-odd lines typed in a hurry, and a mistyped date is much easier to fix
 * in the file than in the pantry afterwards.
 */
export default function PantryImport({ onImported }: PantryImportProps) {
  const { locale, t, plural } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<ImportMode>("append");
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);

  const send = async (isDryRun: boolean): Promise<ImportResponse | null> => {
    setIsBusy(true);
    setErrorMessage("");
    setFeedback("");

    try {
      const response = await fetch(`${backendApiUrl}/api/pantry-items/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ csv: csvText, dryRun: isDryRun, mode })
      });

      const data = (await response.json().catch(() => ({}))) as ImportResponse & {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(data.message || t("pantry.import.failed"));
        return null;
      }

      return data;
    } catch (_error) {
      setErrorMessage(t("pantry.import.failed"));
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    setFileName(file.name);
    setPreview(null);
    setFeedback("");
    setErrorMessage("");
    setCsvText(await file.text());
  };

  const runPreview = async () => {
    const result = await send(true);

    if (result) {
      setPreview(result);
    }
  };

  const runImport = async () => {
    const result = await send(false);

    if (!result) {
      return;
    }

    setPreview(null);
    setCsvText("");
    setFileName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (result.pantryItems) {
      onImported(result.pantryItems);
    }

    setFeedback(
      result.mode === "replace"
        ? t("pantry.import.replaced", {
            imported: result.importedCount,
            removed: result.replacedCount
          })
        : plural("pantry.import.added", result.importedCount)
    );
  };

  const hasText = csvText.trim().length > 0;

  return (
    <SectionCard
      description={t("pantry.import.description")}
      icon={<FileUp className="h-4 w-4" />}
      title={t("pantry.import.title")}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-fg" htmlFor="pantry-import-file">
              {t("pantry.import.fileLabel")}
            </label>
            <input
              accept=".csv,text/csv,text/plain"
              className={controlClassName}
              id="pantry-import-file"
              onChange={(event) => {
                void handleFileChange(event.target.files?.[0] ?? null);
              }}
              ref={fileInputRef}
              type="file"
            />
            <p className="text-xs text-fg-subtle">
              {fileName || t("pantry.import.fileHint")}
            </p>
          </div>

          <SelectField
            hint={
              mode === "replace"
                ? t("pantry.import.modeReplaceHint")
                : t("pantry.import.modeAppendHint")
            }
            label={t("pantry.import.modeLabel")}
            onChange={(event) => {
              setMode(event.target.value as ImportMode);
              setPreview(null);
            }}
            value={mode}
          >
            <option value="append">{t("pantry.import.modeAppend")}</option>
            <option value="replace">{t("pantry.import.modeReplace")}</option>
          </SelectField>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-fg" htmlFor="pantry-import-text">
            {t("pantry.import.pasteLabel")}
          </label>
          <textarea
            className={`${controlClassName} resize-y font-mono text-xs`}
            id="pantry-import-text"
            onChange={(event) => {
              setCsvText(event.target.value);
              setPreview(null);
            }}
            placeholder={`${exampleHeader}\ndåse majs,3,,,\nHonning flydende,"0,5",flaske,,`}
            rows={5}
            value={csvText}
          />
          <p className="text-xs text-fg-subtle">{t("pantry.import.formatHint")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isBusy || !hasText} onClick={() => void runPreview()} variant="secondary">
            {isBusy ? t("common.working") : t("pantry.import.preview")}
          </Button>
          {preview && preview.rows.length > 0 ? (
            <Button
              disabled={isBusy}
              onClick={() => {
                if (mode === "replace") {
                  setIsConfirmingReplace(true);
                  return;
                }

                void runImport();
              }}
            >
              <Upload className="h-4 w-4" />
              {plural("pantry.import.submit", preview.rows.length)}
            </Button>
          ) : null}
        </div>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
        {feedback ? <Alert tone="success">{feedback}</Alert> : null}

        {preview ? (
          <div className="space-y-3">
            {preview.rows.length === 0 ? (
              <Alert tone="warning">{t("pantry.import.nothingReadable")}</Alert>
            ) : (
              <p className="text-sm text-fg-muted">
                {plural("pantry.import.previewCount", preview.rows.length)}
              </p>
            )}

            {preview.errors.length > 0 ? (
              <Alert tone="warning">
                <span className="font-semibold">
                  {plural("pantry.import.errorCount", preview.errors.length)}
                </span>
                <ul className="mt-2 space-y-1">
                  {preview.errors.map((rowError) => (
                    <li key={rowError.lineNumber}>
                      {t("pantry.import.lineLabel", { line: rowError.lineNumber })}{" "}
                      {rowError.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {preview.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-fg-subtle">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t("common.name")}</th>
                      <th className="px-3 py-2 font-semibold">{t("common.quantity")}</th>
                      <th className="px-3 py-2 font-semibold">{t("common.unit")}</th>
                      <th className="px-3 py-2 font-semibold">
                        {t("pantry.expirationLabel")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr className="border-t border-border align-top" key={row.lineNumber}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-fg">{row.name}</span>
                          {row.warnings.length > 0 ? (
                            <span className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {row.warnings.join(" ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-fg-muted">{row.quantity}</td>
                        <td className="px-3 py-2 text-fg-muted">{row.unit ?? "—"}</td>
                        <td className="px-3 py-2 text-fg-muted">
                          {row.expirationDate ? (
                            row.expirationDate
                          ) : (
                            <Badge tone="neutral">{t("pantry.noDate")}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("pantry.import.replaceConfirm")}
        confirmVariant="danger"
        description={t("pantry.import.replaceDescription", {
          removed: preview?.replacedCount ?? 0,
          imported: preview?.rows.length ?? 0
        })}
        isLoading={isBusy}
        isOpen={isConfirmingReplace}
        onCancel={() => setIsConfirmingReplace(false)}
        onConfirm={() => {
          setIsConfirmingReplace(false);
          void runImport();
        }}
        title={t("pantry.import.replaceTitle")}
      />
    </SectionCard>
  );
}
