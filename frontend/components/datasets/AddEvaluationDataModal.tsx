"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, ClipboardPaste, FileDown, Loader2, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { PreviewTable, needsReview } from "./PreviewTable";
import { DatasetFormatIcon } from "./DatasetFormatIcon";
import { toEditable, type ApiError, type DatasetPreviewDto, type EditableCase } from "./types";
import { SOURCE_FORMATS, type DetectionFormat } from "@/lib/datasets/formats";
import type { Dataset } from "@/types";

type Tab = "upload" | "paste" | "manual";
type Step = "source" | "preview";

interface AddEvaluationDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided the modal Appends (imports into this dataset); otherwise it creates a new one. */
  dataset?: Dataset | null;
  onImported: (dataset: Dataset, imported: number) => void;
}

interface PreviewState {
  detection: DatasetPreviewDto["detection"];
  file: DatasetPreviewDto["file"];
  summary: DatasetPreviewDto["summary"];
  warnings: string[];
  columns: string[];
  rawRecords: Record<string, string>[];
  mapping: DatasetPreviewDto["mapping"];
  cases: EditableCase[];
}

const EMPTY_ROW = (): EditableCase => ({ key: `m-${Math.random().toString(36).slice(2, 8)}`, input: "", expectedOutput: "", context: "" });

export function AddEvaluationDataModal({ isOpen, onClose, dataset, onImported }: AddEvaluationDataModalProps) {
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState<Step>("source");
  const [tab, setTab] = useState<Tab>("upload");

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Paste
  const [pasteContent, setPasteContent] = useState("");
  const [pasting, setPasting] = useState(false);

  // Manual
  const [manualRows, setManualRows] = useState<EditableCase[]>([EMPTY_ROW()]);

  // Review/preview state
  const [preview, setPreview] = useState<PreviewState | null>(null);

  // New-dataset form (preview step)
  const [form, setForm] = useState({ name: "", description: "", version: "v1.0" });
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const isAppend = Boolean(dataset);

  const reset = useCallback(() => {
    setStep("source");
    setTab("upload");
    setFile(null);
    setError(null);
    setAnalyzing(false);
    setPasteContent("");
    setPasting(false);
    setManualRows([EMPTY_ROW()]);
    setPreview(null);
    setForm({ name: "", description: "", version: "v1.0" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(reset, 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, reset]);

  const validCount = useMemo(() => (preview ? preview.cases.filter((c) => c.input.trim()).length : 0), [preview]);
  const reviewCount = useMemo(() => (preview ? preview.cases.filter(needsReview).length : 0), [preview]);

  const applyPreview = (dto: DatasetPreviewDto) => {
    setPreview({
      detection: dto.detection,
      file: dto.file,
      summary: dto.summary,
      warnings: dto.warnings ?? [],
      columns: dto.columns ?? [],
      rawRecords: dto.rawRecords ?? [],
      mapping: dto.mapping ?? null,
      cases: (dto.cases ?? []).map(toEditable),
    });
    setStep("preview");
  };

  // ---- Upload flow
  const uploadAndAnalyze = useCallback(
    async (f: File, mapping?: { input?: string; expectedOutput?: string; context?: string }) => {
      setAnalyzing(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", f);
        if (mapping) fd.append("mapping", JSON.stringify(mapping));
        const res = await fetch("/api/datasets/upload", { method: "POST", body: fd });
        const json = (await res.json()) as DatasetPreviewDto | ApiError;
        if (json.status === "success") {
          applyPreview(json);
          if (!form.name.trim()) {
            const base = f.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
            setForm((prev) => ({ ...prev, name: prev.name || base.slice(0, 80) }));
          }
        } else {
          setError(json);
        }
      } catch {
        setError({ status: "error", error: "Could not reach the server. Check your connection and try again." });
      } finally {
        setAnalyzing(false);
      }
    },
    [form.name]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    void uploadAndAnalyze(f);
  };

  // ---- Paste flow
  const analyzePaste = useCallback(async (mapping?: { input?: string; expectedOutput?: string; context?: string }) => {
    if (!pasteContent.trim()) return;
    setPasting(true);
    setError(null);
    try {
      const res = await fetch("/api/datasets/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pasteContent, mapping }),
      });
      const json = (await res.json()) as DatasetPreviewDto | ApiError;
      if (json.status === "success") {
        applyPreview(json);
      } else {
        setError(json);
      }
    } catch {
      setError({ status: "error", error: "Could not reach the server. Check your connection and try again." });
    } finally {
      setPasting(false);
    }
  }, [pasteContent]);

  // ---- Mapping override (re-extract with chosen columns)
  const reExtractWithMapping = useCallback(
    (mapping: { input?: string; expectedOutput?: string; context?: string }) => {
      if (file) void uploadAndAnalyze(file, mapping);
      else void analyzePaste(mapping);
    },
    [file, uploadAndAnalyze, analyzePaste]
  );

  // ---- Manual review entry
  const enterManualPreview = () => {
    const rows = manualRows.filter((r) => r.input.trim() || r.expectedOutput.trim() || r.context.trim());
    const cases: EditableCase[] = rows.map((r) => ({ ...r, issue: r.input.trim() ? r.issue ?? null : "Missing question.", confidence: 1 }));
    if (cases.length === 0) {
      setError({ status: "error", error: "Add at least one row (a question/input is required) before reviewing." });
      return;
    }
    setPreview({
      detection: { kind: "manual", label: "Manual entry", extension: null, extensionMessage: null, needsReview: cases.some(needsReview), message: null, sheets: [] },
      file: { name: "manual-entry", sizeBytes: 0 },
      summary: { total: cases.length, valid: cases.length - cases.filter(needsReview).length, needsReview: cases.filter(needsReview).length, skipped: 0 },
      warnings: cases.some((c) => !c.input.trim()) ? ["Some rows are missing a question/input — they will be skipped."] : [],
      columns: [],
      rawRecords: [],
      mapping: null,
      cases,
    });
    setStep("preview");
  };

  // ---- Import (commit)
  const importCases = async () => {
    if (!preview) return;
    const cases = preview.cases
      .filter((c) => c.input.trim())
      .map((c) => ({ input: c.input.trim(), expectedOutput: c.expectedOutput.trim() || undefined, context: c.context.trim() || undefined }));
    if (cases.length === 0) {
      toastError("Nothing to import", "Add at least one row with a question/input.");
      return;
    }
    if (!isAppend && !form.name.trim()) {
      toastError("Name required", "Give the dataset a name first.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        cases,
        source: { format: preview.detection.kind },
      };
      if (isAppend && dataset) payload.datasetId = dataset.id;
      else {
        payload.name = form.name.trim();
        if (form.description.trim()) payload.description = form.description.trim();
        if (form.version.trim()) payload.version = form.version.trim();
      }
      const res = await fetch("/api/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.status === "success") {
        success(isAppend ? "Cases added" : "Dataset created", `${json.imported} test case${json.imported === 1 ? "" : "s"} imported.`);
        onImported(json.dataset, json.imported);
        reset();
        onClose();
      } else {
        toastError("Import failed", json.error || "Something went wrong.");
      }
    } catch {
      toastError("Import failed", "Could not reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sourceLabel = preview ? SOURCE_FORMATS[preview.detection.kind as DetectionFormat]?.label ?? preview.detection.label : "";
  const fileSize = preview && preview.file.sizeBytes > 0 ? formatBytes(preview.file.sizeBytes) : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={isAppend ? `Add cases to “${dataset?.name}”` : "Add evaluation data"}
      description={
        isAppend
          ? "New cases are appended to this dataset. Review them before importing."
          : "Upload a file, paste data, or create cases manually. Every source becomes the same review table, then a dataset."
      }
    >
      {/* ---- SOURCE STEP ---- */}
      {step === "source" && (
        <div>
          {/* Tab switch */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] p-1 mb-6">
            {(
              [
                ["upload", "Upload a file", UploadCloud],
                ["paste", "Paste data", ClipboardPaste],
                ["manual", "Create manually", FileDown],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${tab === value ? "bg-[#C8A96E] text-[#0F0F0F]" : "text-stone-400 hover:text-[#F5F1EB]"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {/* Upload panel */}
          {tab === "upload" && (
            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#2A2A28] bg-[#141416] px-6 py-10 text-center transition hover:border-[#C8A96E]/60 hover:bg-[#161618]">
                <UploadCloud className="h-8 w-8 text-[#C8A96E]" />
                <div>
                  <p className="text-sm font-medium text-[#F5F1EB]">Choose a file to analyze</p>
                  <p className="mt-1 text-xs text-stone-500">
                    JSON · JSONL · CSV · Excel · TXT · Markdown · HTML · PDF · Word — up to 25 MB
                  </p>
                </div>
                {analyzing && (
                  <span className="flex items-center gap-2 text-sm text-[#C8A96E]"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing your file…</span>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={analyzing} />
              </label>
              {!file && !analyzing && !error && (
                <p className="mt-3 text-xs text-stone-500">We detect the format from the content — a file named <code className="text-stone-400">data.json.txt</code> containing JSON is imported as JSON.</p>
              )}
            </div>
          )}

          {/* Paste panel */}
          {tab === "paste" && (
            <div>
              <textarea
                ref={pasteRef}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder={"Paste JSON, JSON Lines, CSV, or Q:/A: text here…\n\nExample:\nQ: What is the capital of France?\nA: Paris"}
                className="min-h-[280px] w-full rounded-xl bg-[#141416] border border-[#2A2A28] px-4 py-3 text-sm font-mono text-[#F5F1EB] placeholder:text-stone-600 focus:outline-none focus:border-[#C8A96E]"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-stone-500">Paste spreads easily — no need to create a file.</p>
                <Button onClick={() => void analyzePaste()} isLoading={pasting} disabled={!pasteContent.trim()} rightIcon={<ClipboardPaste className="h-4 w-4" />}>
                  Detect &amp; preview
                </Button>
              </div>
            </div>
          )}

          {/* Manual panel */}
          {tab === "manual" && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="info" size="sm">No JSON required</Badge>
                <p className="text-xs text-stone-500">Type each row like a row in a review sheet.</p>
              </div>
              <div className="space-y-2">
                {manualRows.map((row, i) => (
                  <div key={row.key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input value={row.input} placeholder={`Question #${i + 1}`} onChange={(e) => setManualRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, input: e.target.value } : r)))} />
                    <Input value={row.expectedOutput} placeholder="Expected answer (optional)" onChange={(e) => setManualRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, expectedOutput: e.target.value } : r)))} />
                    <Input value={row.context} placeholder="Context (optional)" onChange={(e) => setManualRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, context: e.target.value } : r)))} />
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setManualRows((rs) => { const next = [...rs]; next.splice(i + 1, 0, EMPTY_ROW()); return next; })} aria-label="Insert row" className="text-stone-500">＋</Button>
                      <Button size="icon" variant="ghost" onClick={() => setManualRows((rs) => rs.filter((r) => r.key !== row.key))} aria-label="Remove row" className="text-stone-500"><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button variant="secondary" onClick={() => setManualRows((rs) => [...rs, EMPTY_ROW()])}>＋ Add row</Button>
                <Button onClick={enterManualPreview} disabled={!manualRows.some((r) => r.input.trim())}>
                  Review &amp; import
                </Button>
              </div>
            </div>
          )}

          {/* Friendly error + recovery */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
              <p className="flex items-start gap-2 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setError(null); }}>Try again</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("paste")}>Paste data instead</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("manual")}>Create manually</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- PREVIEW STEP ---- */}
      {step === "preview" && preview && (
        <div>
          {/* Detection summary */}
          <div className="mb-5 rounded-xl border border-[#2A2A28] bg-[#141416] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8A96E]/15 text-[#C8A96E]">
                {preview ? (
                  <DatasetFormatIcon format={preview.detection.kind} className="h-5 w-5" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[#F5F1EB]">{sourceLabel}</p>
                  <Badge size="sm" variant="neutral">{preview.detection.kind}</Badge>
                  {preview.detection.extension && <Badge size="sm" variant="neutral">{file ? file.name : pasteContent ? "pasted-data.txt" : ""}</Badge>}
                  {fileSize && <span className="text-xs text-stone-500">{fileSize}</span>}
                </div>
                {preview.detection.extensionMessage && <p className="mt-1 text-xs text-[#C8A96E]">{preview.detection.extensionMessage}</p>}
              </div>
              <div className="flex gap-2">
                <Badge variant="success" size="sm"><CheckCircle2 className="h-3 w-3" /> {preview.summary.valid} valid</Badge>
                {reviewCount > 0 && <Badge variant="warning" size="sm"><AlertTriangle className="h-3 w-3" /> {reviewCount} need review</Badge>}
              </div>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[#2A2A28] pt-3">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-400"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8A96E]" /> {w}</li>
                ))}
              </ul>
            )}
            {preview.detection.message && (
              <p className="mt-3 text-sm text-amber-300">{preview.detection.message}</p>
            )}
          </div>

          {/* Edit table */}
          <PreviewTable
            cases={preview.cases}
            onChange={(cases) => setPreview((p) => (p ? { ...p, cases } : p))}
            columns={preview.columns}
            mapping={preview.mapping}
            onMappingChange={preview.columns.length > 0 ? reExtractWithMapping : undefined}
          />

          {/* New-dataset metadata */}
          {!isAppend ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <Input label="Dataset name *" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Customer support triage QA" />
              <Input label="Version" value={form.version} maxLength={20} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              <div className="sm:col-span-2">
                <Input label="Description (optional)" value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this dataset about?" />
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-stone-400">
              Importing <span className="text-[#F5F1EB]">{validCount}</span> case{validCount === 1 ? "" : "s"} into <span className="font-medium text-[#F5F1EB]">{dataset?.name}</span>.
            </p>
          )}

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep("source")} disabled={submitting}>← Back</Button>
            <div className="flex items-center gap-3">
              {validCount === 0 && <p className="text-xs text-amber-400">No usable rows yet — add a question to import.</p>}
              <Button onClick={() => void importCases()} isLoading={submitting} disabled={validCount === 0 || (isAppend ? false : !form.name.trim())}>
                {isAppend ? `Import ${validCount} case${validCount === 1 ? "" : "s"}` : `Create dataset with ${validCount} case${validCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}