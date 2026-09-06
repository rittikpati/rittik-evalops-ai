"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Loader2, Play, PlusCircle, Plus, Trash2, Edit, Check, X, Download, Info } from "lucide-react";
import { DashboardLayout, PageContainer } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AddEvaluationDataModal } from "@/components/datasets/AddEvaluationDataModal";
import { DatasetFormatIcon } from "@/components/datasets/DatasetFormatIcon";
import { labelForDatasetFormat } from "@/lib/datasets/formats";
import { formatNumber, formatRelativeTime } from "@/frontend/lib/utils";
import type { Dataset, TestCase } from "@/types";

interface EditableRow {
  input: string;
  expectedOutput: string;
  context: string;
}

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [editCaseId, setEditCaseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditableRow>({ input: "", expectedOutput: "", context: "" });

  const [newRows, setNewRows] = useState<EditableRow[]>([]);
  const [savingNew, setSavingNew] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const newInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dRes, cRes] = await Promise.all([
        fetch(`/api/datasets/${encodeURIComponent(id)}`),
        fetch(`/api/datasets/${encodeURIComponent(id)}/cases`),
      ]);
      const dJson = await dRes.json();
      const cJson = await cRes.json();
      if (dJson.status === "success") setDataset(dJson.dataset);
      else setLoadError(dJson.error || "Dataset not found.");
      if (cJson.status === "success") setCases(cJson.testCases);
    } catch {
      setLoadError("Could not reach the server. Check your connection.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(t);
  }, [loadAll]);

  const sourceTag = useMemo(() => (dataset?.tags ?? []).find((t) => t.startsWith("source:")), [dataset]);
  const sourceFormat = sourceTag?.replace("source:", "") ?? dataset?.format ?? "txt";

  const toggleEditMeta = () => {
    if (!editMetaOpen) {
      setEditName(dataset?.name ?? "");
      setEditDescription(dataset?.description ?? "");
    }
    setEditMetaOpen((v) => !v);
  };

  const saveMeta = async () => {
    if (!editName.trim()) {
      toastError("Name required", "Dataset name cannot be empty.");
      return;
    }
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || undefined }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setDataset(json.dataset);
        setEditMetaOpen(false);
        success("Dataset updated", "Name and description saved.");
      } else {
        toastError("Update failed", json.error || "Unknown");
      }
    } catch {
      toastError("Update failed", "Could not reach the server.");
    }
  };

  const startEditCase = (tc: TestCase) => {
    setEditCaseId(tc.id);
    setEditDraft({ input: tc.input, expectedOutput: tc.expectedOutput, context: tc.context ?? "" });
  };

  const saveEditCase = async () => {
    if (!editDraft.input.trim()) {
      toastError("Input required", "A question/input is required.");
      return;
    }
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(id)}/cases/${encodeURIComponent(editCaseId!)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: editDraft.input.trim(),
          expectedOutput: editDraft.expectedOutput.trim() || undefined,
          context: editDraft.context.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setCases((cs) => cs.map((c) => (c.id === editCaseId ? json.testCase : c)));
        setEditCaseId(null);
        success("Case updated", "Changes saved.");
      } else {
        toastError("Update failed", json.error || "Unknown");
      }
    } catch {
      toastError("Update failed", "Could not reach the server.");
    }
  };

  const addNewRow = () => setNewRows((rs) => [...rs, { input: "", expectedOutput: "", context: "" }]);

  const saveNewRows = async () => {
    const valid = newRows.filter((r) => r.input.trim());
    if (valid.length === 0) {
      toastError("Nothing to add", "Add at least one row with a question/input.");
      return;
    }
    setSavingNew(true);
    try {
      let added = 0;
      for (const r of valid) {
        const res = await fetch(`/api/datasets/${encodeURIComponent(id)}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: r.input.trim(),
            expectedOutput: r.expectedOutput.trim() || undefined,
            context: r.context.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (json.status === "success" && json.testCase) {
          setCases((cs) => [...cs, json.testCase]);
          added++;
        }
      }
      setNewRows([]);
      if (added > 0) {
        success("Cases added", `${added} test case${added === 1 ? "" : "s"} added.`);
        await loadAll();
      }
    } catch {
      toastError("Add failed", "Could not reach the server.");
    }
    setSavingNew(false);
  };

  const confirmDeleteCase = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(id)}/cases/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status === "success") {
        setCases((cs) => cs.filter((c) => c.id !== deleteTarget.id));
        success("Case deleted", "Removed from this dataset.");
      } else {
        toastError("Delete failed", json.error || "Unknown");
      }
    } catch {
      toastError("Delete failed", "Could not reach the server.");
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const download = async () => {
    if (!dataset) return;
    await new Promise<void>((resolve) => {
      const payload = { dataset, testCases: cases, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "dataset"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    });
    success("Download complete", `${dataset.name} downloaded as JSON.`);
  };

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Back */}
        <button className="mb-6 flex items-center gap-2 text-sm text-stone-400 transition hover:text-[#F5F1EB]" onClick={() => router.push("/datasets")}>
          <ArrowLeft className="h-4 w-4" /> All datasets
        </button>

        {loading && !dataset && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#C8A96E]" />
          </div>
        )}

        {loadError && !dataset && (
          <Card className="p-12 text-center text-sm text-red-300">{loadError}</Card>
        )}

        {dataset && (
          <>
            {/* Meta */}
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F0F0F] border border-[#2A2A28] text-[#C8A96E]">
                  <DatasetFormatIcon format={dataset.format} className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-serif text-2xl tracking-tight text-[#F5F1EB]">{dataset.name}</h1>
                    <Badge variant="neutral">{labelForDatasetFormat(sourceFormat)}</Badge>
                    <span className="text-xs text-stone-500">v{dataset.version}</span>
                  </div>
                  {dataset.description && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-400">{dataset.description}</p>}
                  {sourceTag && <p className="mt-1.5 text-xs text-[#C8A96E]/80">Imported from {sourceFormat}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={() => void download()}>Download</Button>
                <Button variant="secondary" leftIcon={<Edit className="h-4 w-4" />} onClick={toggleEditMeta}>Edit dataset</Button>
                <Button variant="secondary" leftIcon={<PlusCircle className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Import more</Button>
                <Button onClick={() => router.push(`/experiments/new?dataset=${encodeURIComponent(dataset.id)}`)} leftIcon={<Play className="h-4 w-4" />}>
                  Run evaluation
                </Button>
              </div>
            </div>

            {/* Edit dataset meta */}
            <AnimatePresence>
              {editMetaOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Card className="mb-8 p-5">
                    <div className="grid grid-cols-1 gap-3">
                      <Input label="Dataset name" value={editName} maxLength={80} onChange={(e) => setEditName(e.target.value)} />
                      <Input label="Description (optional)" value={editDescription} maxLength={2000} onChange={(e) => setEditDescription(e.target.value)} placeholder="What is this dataset about?" />
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <Button variant="ghost" onClick={toggleEditMeta}>Cancel</Button>
                      <Button onClick={() => void saveMeta()}>Save changes</Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Test cases", value: formatNumber(dataset.testCases) },
                { label: "Source format", value: labelForDatasetFormat(sourceFormat) },
                { label: "Version", value: `v${dataset.version}` },
                { label: "Last updated", value: formatRelativeTime(dataset.lastUpdated) },
              ].map((s) => (
                <Card key={s.label} className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">{s.label}</p>
                  <p className="mt-1 truncate font-mono text-sm text-[#F5F1EB]">{s.value}</p>
                </Card>
              ))}
            </div>

            {/* Inline add cases */}
            <Card className="mb-6 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[#F5F1EB]">Add test cases manually</p>
                <Button size="sm" variant="secondary" onClick={addNewRow} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add row</Button>
              </div>
              {newRows.length === 0 ? (
                <p className="text-sm text-stone-500">Type a few questions below without writing any JSON.</p>
              ) : (
                <div className="space-y-2">
                  {newRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <Input ref={i === 0 ? newInputRef : undefined} value={row.input} placeholder={`Question #${i + 1}`} onChange={(e) => setNewRows((rs) => rs.map((r, j) => (j === i ? { ...r, input: e.target.value } : r)))} />
                      <Input value={row.expectedOutput} placeholder="Expected answer (optional)" onChange={(e) => setNewRows((rs) => rs.map((r, j) => (j === i ? { ...r, expectedOutput: e.target.value } : r)))} />
                      <Input value={row.context} placeholder="Context (optional)" onChange={(e) => setNewRows((rs) => rs.map((r, j) => (j === i ? { ...r, context: e.target.value } : r)))} />
                      <Button size="icon" variant="ghost" className="text-stone-500" onClick={() => setNewRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove row"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button onClick={() => void saveNewRows()} isLoading={savingNew} disabled={!newRows.some((r) => r.input.trim())}>
                      Save cases
                    </Button>
                  </div>
                </div>
              )}
              {newRows.length === 0 && (
                <button className="text-left text-sm text-[#C8A96E]" onClick={() => { addNewRow(); setTimeout(() => newInputRef.current?.focus(), 0); }}>
                  + Add a test case
                </button>
              )}
            </Card>

            {/* Cases table */}
            <Card className="overflow-hidden">
              <div className="border-b border-[#2A2A28] px-5 py-4">
                <p className="text-sm font-medium text-[#F5F1EB]">Test cases</p>
                <p className="mt-0.5 text-xs text-stone-500">Used as ground truth for every evaluation on this dataset.</p>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[#2A2A28] bg-[#161618] text-left text-xs uppercase tracking-wider text-stone-500">
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-3 py-3 w-[34%]">Question / input</th>
                      <th className="px-3 py-3 w-[27%]">Expected answer</th>
                      <th className="px-3 py-3 hidden lg:table-cell w-[22%]">Context</th>
                      <th className="px-3 py-3 text-right w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((tc, i) =>
                      editCaseId === tc.id ? (
                        <tr key={tc.id} className="border-b border-[#1A1A1E] bg-[#C8A96E]/[0.04]">
                          <td className="px-4 py-2 align-top text-xs text-stone-500">{cases.indexOf(tc) + 1}</td>
                          <td className="px-3 py-2 align-top"><Input className="py-1.5 text-sm" value={editDraft.input} onChange={(e) => setEditDraft({ ...editDraft, input: e.target.value })} /></td>
                          <td className="px-3 py-2 align-top"><Input className="py-1.5 text-sm" value={editDraft.expectedOutput} onChange={(e) => setEditDraft({ ...editDraft, expectedOutput: e.target.value })} /></td>
                          <td className="px-3 py-2 align-top hidden lg:table-cell"><Input className="py-1.5 text-sm" value={editDraft.context} onChange={(e) => setEditDraft({ ...editDraft, context: e.target.value })} /></td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400" onClick={() => void saveEditCase()} aria-label="Save case"><Check className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditCaseId(null)} aria-label="Cancel editing"><X className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={tc.id} className="border-b border-[#1A1A1E] transition hover:bg-white/[0.02]">
                          <td className="px-4 py-3 align-top text-xs text-stone-500">{i + 1}</td>
                          <td className="px-3 py-3 align-top whitespace-pre-wrap break-words text-stone-200">{tc.input}</td>
                          <td className="px-3 py-3 align-top whitespace-pre-wrap break-words text-stone-400">{tc.expectedOutput || <span className="text-stone-600">â€”</span>}</td>
                          <td className="px-3 py-3 align-top whitespace-pre-wrap break-words text-stone-500 hidden lg:table-cell">{tc.context || <span className="text-stone-600">â€”</span>}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditCase(tc)} aria-label="Edit case"><Edit className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-400 hover:text-red-400" onClick={() => setDeleteTarget(tc)} aria-label="Delete case"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                    {cases.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                          <Info className="mx-auto mb-3 h-6 w-6 text-stone-600" />
                          No test cases yet. Add some above, or import a file.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </PageContainer>

      <AddEvaluationDataModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        dataset={dataset}
        onImported={() => { void loadAll(); }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteCase()}
        title="Delete this test case?"
        message="This question/answer pair will be removed from the dataset."
        confirmLabel="Delete case"
        variant="danger"
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}