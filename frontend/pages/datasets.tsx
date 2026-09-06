"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { Database, Search, Download, Trash2, PlusCircle, Sparkles, Loader2, FileText, ArrowRight } from "lucide-react";
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
import { EXAMPLE_DATASET } from "@/lib/datasets/example";
import { formatNumber, formatRelativeTime } from "@/frontend/lib/utils";
import type { Dataset } from "@/types";

export default function DatasetsPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exampleLoading, setExampleLoading] = useState(false);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/datasets");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.datasets)) setDatasets(json.datasets);
      else setLoadError(json.error || "Failed to load datasets.");
    } catch {
      setLoadError("Could not reach the server. Check your connection.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadDatasets(), 0);
    return () => window.clearTimeout(t);
  }, [loadDatasets]);

  const formats = useMemo(() => {
    const set = new Set<string>();
    for (const d of datasets) {
      if (d.format) set.add(d.format);
      (d.tags ?? []).forEach((t) => {
        if (t.startsWith("source:")) set.add(t.replace("source:", ""));
      });
    }
    return ["all", ...set];
  }, [datasets]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return datasets.filter((d) => {
      const text = `${d.name} ${d.description ?? ""}`.toLowerCase();
      const matchesSearch = !q || text.includes(q);
      const matchesFormat = formatFilter === "all" || d.format === formatFilter || (d.tags ?? []).includes(`source:${formatFilter}`);
      return matchesSearch && matchesFormat;
    });
  }, [datasets, searchQuery, formatFilter]);

  const tryExample = async () => {
    setExampleLoading(true);
    try {
      const res = await fetch("/api/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: EXAMPLE_DATASET.name,
          description: EXAMPLE_DATASET.description,
          version: EXAMPLE_DATASET.version,
          source: { format: "txt" },
          cases: EXAMPLE_DATASET.cases,
        }),
      });
      const json = await res.json();
      if (json.status === "success" && json.dataset) {
        success("Example dataset created", `${json.imported} test cases ready to evaluate.`);
        await loadDatasets();
      } else {
        toastError("Couldn't create example", json.error || "Please try again.");
      }
    } catch {
      toastError("Couldn't create example", "Please try again.");
    }
    setExampleLoading(false);
  };

  const download = async (ds: Dataset) => {
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(ds.id)}`);
      const j = await res.json();
      if (j.status !== "success") {
        toastError("Download failed", j.error || "Unknown");
        return;
      }
      const payload = { dataset: j.dataset, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ds.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "dataset"}-${ds.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success("Download complete", `${ds.name} downloaded as JSON.`);
    } catch (e) {
      toastError("Download failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.status === "success") {
        success("Dataset deleted", `â€œ${deleteTarget.name}â€ was removed.`);
        setDatasets((ds) => ds.filter((d) => d.id !== deleteTarget.id));
      } else {
        toastError("Delete failed", j.error || "Unknown");
      }
    } catch {
      toastError("Delete failed", "Could not reach the server.");
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const empty = !loading && datasets.length === 0;

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight text-[#F5F1EB]">Datasets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">
              Evaluation data is the ground truth for every experiment. Upload a file, paste data, or create cases
              manually â€” everything lands in the same review table before it becomes a dataset.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void tryExample()} isLoading={exampleLoading} leftIcon={<Sparkles className="h-4 w-4" />}>
              Try example dataset
            </Button>
            <Button onClick={() => setModalOpen(true)} leftIcon={<PlusCircle className="h-4 w-4" />}>
              Add evaluation data
            </Button>
          </div>
        </div>

        {/* Empty state */}
        <AnimatePresence mode="wait">
          {empty && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="py-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C8A96E]/10 text-[#C8A96E]">
                  <Database className="h-8 w-8" />
                </div>
                <h2 className="mt-6 font-serif text-xl text-[#F5F1EB]">No datasets yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-400">
                  Start by pasting a few Q&#8203;/A pairs, uploading a JSON or CSV file, or letting us create a small
                  example you can run an evaluation on right away.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={() => setModalOpen(true)} leftIcon={<PlusCircle className="h-4 w-4" />}>
                    Add evaluation data
                  </Button>
                  <Button variant="secondary" onClick={() => void tryExample()} isLoading={exampleLoading}>
                    Try the example dataset
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {!empty && (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {/* Search + filters */}
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full lg:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <Input className="pl-10" placeholder="Search datasetsâ€¦" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formats.map((f) => (
                    <Badge
                      key={f}
                      variant={formatFilter === f ? "accent" : "neutral"}
                      className="cursor-pointer select-none"
                      onClick={() => setFormatFilter(f)}
                    >
                      {f === "all" ? "All formats" : labelForDatasetFormat(f)}
                    </Badge>
                  ))}
                </div>
              </div>

              {loadError && (
                <p className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">{loadError}</p>
              )}

              {/* Dataset rows */}
              <div className="space-y-3">
                {filtered.map((ds, i) => {
                  const sourceTag = (ds.tags ?? []).find((t) => t.startsWith("source:"));
                  const sourceFormat = sourceTag?.replace("source:", "") ?? ds.format;
                  return (
                    <motion.div
                      key={ds.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card className="group flex flex-col gap-4 p-5 transition hover:border-[#3A3A38] sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-4" onClick={() => router.push(`/datasets/${ds.id}`)}>
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F0F0F] border border-[#2A2A28] text-stone-400">
                            <DatasetFormatIcon format={ds.format} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-[#F5F1EB]">{ds.name}</p>
                              <Badge size="sm" variant="neutral">{labelForDatasetFormat(sourceFormat)}</Badge>
                              <span className="text-xs text-stone-500">v{ds.version}</span>
                            </div>
                            {ds.description && <p className="mt-1 truncate text-sm text-stone-500">{ds.description}</p>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-5">
                          <div className="text-right">
                            <p className="font-mono text-sm tabular-nums text-[#F5F1EB]">{formatNumber(ds.testCases)}</p>
                            <p className="text-[11px] uppercase tracking-wide text-stone-500">cases</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="font-mono text-sm tabular-nums text-stone-300">{formatRelativeTime(ds.lastUpdated)}</p>
                            <p className="text-[11px] uppercase tracking-wide text-stone-500">updated</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void download(ds)} aria-label="Download"><Download className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-red-400" onClick={() => setDeleteTarget(ds)} aria-label="Delete dataset"><Trash2 className="h-4 w-4" /></Button>
                            <ArrowRight className="ml-1 h-4 w-4 text-stone-600" />
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
                {filtered.length === 0 && !loadError && (
                  <Card className="p-12 text-center text-sm text-stone-500">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-stone-600" />
                    No datasets match your search.
                  </Card>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>

      {/* Add / Import modal */}
      <AddEvaluationDataModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onImported={(ds) => { void loadDatasets(); router.push(`/datasets/${ds.id}`); }} />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete this dataset?"
        message={`â€œ${deleteTarget?.name}â€ and its ${deleteTarget?.testCases ?? 0} test cases will be permanently removed. Experiments already run keep their results.`}
        confirmLabel="Delete dataset"
        variant="danger"
        isLoading={isDeleting}
      />
      {loading && datasets.length === 0 && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-[#0F0F0F]/60 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#C8A96E]" />
        </div>
      )}
    </DashboardLayout>
  );
}