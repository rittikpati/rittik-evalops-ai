"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Dropdown, DropdownTrigger } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { getModelById, type ModelConfig } from "@/lib/ai/models";
import { DatasetFormatIcon } from "@/components/datasets/DatasetFormatIcon";
import { labelForDatasetFormat } from "@/lib/datasets/formats";
import { formatPercent } from "@/frontend/lib/utils";
import type { Dataset, Experiment, Prompt } from "@/types";
import {
  FlaskConical,
  Plus,
  Search,
  MoreVertical,
  Play,
  RotateCw,
  Eye,
  Edit,
  Trash2,
  Download,
  Clock,
  Database,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  BarChart2,
  ExternalLink,
  FileText,
  Copy,
  FileJson,
  Sparkles,
} from "@/components/layout/Icons";
import { formatRelativeTime } from "@/frontend/lib/utils";

const statuses = ["draft", "running", "completed", "failed", "cancelled"] as const;

export default function ExperimentsPage() {
  const { success, error: toastError } = useToast();
  const router = useRouter();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDatasetId, setCreateDatasetId] = useState("");
  const [createModelIds, setCreateModelIds] = useState<string[]>(["dots-3-note-preview"]);
  const [createSystemPrompt, setCreateSystemPrompt] = useState("You are a helpful AI assistant. Answer concisely and accurately.");
  const [createPromptTemplate, setCreatePromptTemplate] = useState("Answer the question based on the context:\n\nContext: {{context}}\nQuestion: {{question}}");
  const [createTemperature, setCreateTemperature] = useState("0.7");
  const [createMaxTokens, setCreateMaxTokens] = useState("512");
  const [createJudgeModel, setCreateJudgeModel] = useState("openrouter/free");
  const [creating, setCreating] = useState(false);
const [datasets, setDatasets] = useState<Dataset[]>([]);
const [datasetsLoading, setDatasetsLoading] = useState(false);
const [datasetMeta, setDatasetMeta] = useState<Record<string, { name: string; format: string; testCases: number }>>({});
const [models, setModels] = useState<ModelConfig[]>([]);
const [modelsLoading, setModelsLoading] = useState(false);
const [savedPrompts, setSavedPrompts] = useState<Prompt[]>([]);
const [createSelectedPromptId, setCreateSelectedPromptId] = useState("");

useEffect(() => {
  let cancelled = false;
  fetch("/api/datasets")
    .then((r) => r.json())
    .then((j) => {
      if (!cancelled && j.status === "success" && Array.isArray(j.datasets)) {
        setDatasetMeta(
          Object.fromEntries(
            (j.datasets as Dataset[]).map((d) => [d.id, { name: d.name, format: d.format, testCases: d.testCases }])
          )
        );
      }
    })
    .catch(() => {});
  return () => {
    cancelled = true;
  };
}, []);

  const [editTarget, setEditTarget] = useState<Experiment | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Experiment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openEdit = (exp: Experiment) => {
    setEditTarget(exp);
    setEditName(exp.name);
    setEditDescription(exp.description || "");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toastError("Name required", "Experiment name cannot be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(editTarget.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription }),
      });
      const j = await res.json();
      if (j.status === "success" && j.experiment) {
        success("Experiment updated", `${j.experiment.name} saved.`);
        setEditTarget(null);
        loadExperiments({ silent: true });
      } else {
        toastError("Update failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Update failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteExperiment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.status === "success") {
        setExperiments((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        success("Experiment deleted", `${deleteTarget.name} was removed.`);
        setDeleteTarget(null);
        loadExperiments({ silent: true });
      } else {
        toastError("Delete failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Delete failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setDeleting(false);
    }
  };

  const duplicateExperiment = async (exp: Experiment) => {
    setDuplicatingId(exp.id);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${exp.name} (Copy)`,
          description: exp.description,
          datasetId: exp.datasetId,
          modelIds: exp.models,
        }),
      });
      const j = await res.json();
      if (j.status === "success" && j.experiment) {
        success("Experiment duplicated", `${j.experiment.name} created â€” runs were not copied.`);
        loadExperiments({ silent: true });
      } else {
        toastError("Duplicate failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Duplicate failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setDuplicatingId(null);
    }
  };

  const exportExperiment = async (exp: Experiment) => {
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(exp.id)}`);
      const j = await res.json();
      if (j.status !== "success") {
        toastError("Export failed", j.error || "Unknown");
        return;
      }
      const payload = { experiment: j.experiment, runs: j.runs, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "experiment"}-${exp.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success("Export complete", "Experiment data downloaded as JSON.");
    } catch (e) {
      toastError("Export failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const loadExperiments = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await fetch("/api/experiments");
      const j = await res.json();
      if (j.status === "success" && Array.isArray(j.experiments)) setExperiments(j.experiments);
      else if (!opts?.silent) setLoadError(j.error || "Failed to load experiments.");
    } catch {
      if (!opts?.silent) setLoadError("Could not reach the server. Check your connection.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };
  useEffect(() => { loadExperiments(); }, []);

  // Load real datasets + models when the create modal opens (single source of truth).
  useEffect(() => {
    if (!isCreateOpen) return;
    let cancelled = false;
    setDatasetsLoading(true);
    setModelsLoading(true);
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.status === "success" && Array.isArray(j.datasets)) setDatasets(j.datasets); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDatasetsLoading(false); });
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.status === "success" && Array.isArray(j.models)) setModels(j.models); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.status === "success" && Array.isArray(j.prompts)) setSavedPrompts(j.prompts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isCreateOpen]);

  const freeModel = models.find((m) => m.pricing.prompt === 0 && m.pricing.completion === 0) ||
    models.find((m) => m.slug === "dots-3-note-preview");

  const handleCreateNew = async () => {
    if (creating) return;
    const name = createName.trim();
    if (!name) { toastError("Name required", "Experiment name is required."); return; }
    if (!createDatasetId) { toastError("Dataset required", "Select a dataset for the experiment."); return; }
    if (createModelIds.length === 0) { toastError("Model required", "Select at least one model."); return; }
    const temperature = Number(createTemperature);
    const maxTokens = parseInt(createMaxTokens, 10);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) { toastError("Invalid temperature", "Enter a temperature between 0 and 2."); return; }
    if (!Number.isFinite(maxTokens) || maxTokens <= 0) { toastError("Invalid max tokens", "Enter a positive max tokens value."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: createDescription.trim() || undefined,
          datasetId: createDatasetId,
          modelIds: createModelIds,
          systemPrompt: createSystemPrompt,
          promptTemplate: createPromptTemplate,
          temperature,
          maxTokens,
          judgeModelId: createJudgeModel,
        }),
      });
      const j = await res.json();
      if (j.status !== "success" || !j.experiment) {
        throw new Error(j.error === "NO_TEST_CASES" ? "The selected dataset has no test cases â€” add cases in Datasets first." : j.error || "Failed to create experiment");
      }
      success("Experiment created", `${j.experiment.name} created â€” open it to run the evaluation.`);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateDatasetId("");
      loadExperiments({ silent: true });
      router.push(`/experiments/${encodeURIComponent(j.experiment.id)}`);
    } catch (e) {
      toastError("Create failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setCreating(false);
    }
  };

  const filteredExperiments = experiments.filter((exp) => {
    const matchesSearch = exp.name.toLowerCase().includes(searchQuery.toLowerCase()) || exp.datasetName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || exp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<Experiment>[] = [
    { key: "name", header: "Experiment", width: "250px", render: (_, row) => (
      <div>
        <p className="font-medium text-foreground">{row.name}</p>
        {row.description && <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">{row.description}</p>}
      </div>
    )},
    { key: "datasetName", header: "Dataset", width: "220px", render: (_, row) => {
      const meta = datasetMeta[row.datasetId];
      return (
        <div className="flex items-center gap-2">
          {meta ? <DatasetFormatIcon format={meta.format} className="h-4 w-4 text-stone-400" /> : <Database className="h-4 w-4 text-stone-400" />}
          <div className="min-w-0">
            <span className="text-stone-300">{row.datasetName}</span>
            {meta && (
              <span className="block text-[11px] text-stone-600">
                {labelForDatasetFormat(meta.format)} Â· {meta.testCases} cases
              </span>
            )}
          </div>
        </div>
      );
    }},
    { key: "models", header: "Models", width: "200px", render: (_, row) => (
      <div className="flex flex-wrap gap-1">
        {row.models.slice(0, 4).map((modelId) => {
          const model = getModelById(modelId);
          return (
            <Badge key={modelId} variant="neutral" size="sm" className="gap-1">
              {model ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#C8A96E] to-[#8B6A43]" />
                  {model.displayName}
                </>
              ) : (
                modelId
              )}
            </Badge>
          );
        })}
        {row.models.length > 4 && <Badge variant="info" size="sm">+{row.models.length - 4}</Badge>}
      </div>
    )},
    { key: "status", header: "Status", width: "130px", render: (_, row) => {
      const statusConfig = {
        draft: { variant: "neutral" as const, label: "Draft" },
        running: { variant: "info" as const, label: "Running" },
        completed: { variant: "success" as const, label: "Completed" },
        failed: { variant: "danger" as const, label: "Failed" },
        cancelled: { variant: "neutral" as const, label: "Cancelled" },
      };
      const config = statusConfig[row.status];
      const score = row.metrics?.accuracy;
      return (
        <div className="space-y-1">
          <Badge variant={config.variant} dot size="sm">{config.label}</Badge>
          {row.status === "completed" && score !== undefined && (
            <p className="text-xs text-stone-500">
              <span className="font-mono font-semibold text-emerald-400">{formatPercent(score)}</span> accuracy
            </p>
          )}
        </div>
      );
    }},
    { key: "progress", header: "Progress", width: "150px", render: (_, row) => (
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-stone-400">{row.completedTestCases}/{row.totalTestCases}</span>
          <span className="font-mono font-semibold">{row.progress}%</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#C8A96E] to-brand-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${row.progress}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </div>
      </div>
    )},
    { key: "updatedAt", header: "Updated", width: "130px", render: (_, row) => formatRelativeTime(row.updatedAt) },
    { key: "actions", header: "", width: "100px", render: (_, row) => (
      <div className="flex items-center gap-1">
        {row.status === "running" && (
          <Link href={`/experiments/${row.id}`}>
            <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#C8A96E] hover:bg-[#C8A96E]/10 transition-smooth" aria-label="View live run" title="Open this experiment to watch the run live">
              <ExternalLink className="h-4 w-4" />
            </button>
          </Link>
        )}
        {row.status === "draft" && (
          <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#C8A96E] hover:bg-[#C8A96E]/10 transition-smooth" aria-label="Run" onClick={() => router.push(`/experiments/${row.id}`)}>
            <Play className="h-4 w-4" />
          </button>
        )}
        {row.status === "failed" && (
          <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#C8A96E] hover:bg-[#C8A96E]/10 transition-smooth" aria-label="Retry" title="Open this experiment to retry" onClick={() => router.push(`/experiments/${row.id}`)}>
            <RotateCw className="h-4 w-4" />
          </button>
        )}
        {row.status === "completed" && (
          <>
            <Link href={`/experiments/${row.id}`}>
              <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" aria-label="View results">
                <BarChart2 className="h-4 w-4" />
              </button>
            </Link>
            <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" aria-label="Download" onClick={() => exportExperiment(row)}>
              <Download className="h-4 w-4" />
            </button>
          </>
        )}
        <Dropdown
          trigger={
            <DropdownTrigger variant="ghost" size="icon" aria-label="More actions">
              <MoreVertical className="h-4 w-4" />
            </DropdownTrigger>
          }
          items={[
            { label: "View Details", onClick: () => router.push(`/experiments/${row.id}`), icon: <Eye className="h-4 w-4" /> },
            { label: "Edit", onClick: () => openEdit(row), icon: <Edit className="h-4 w-4" /> },
            { label: "Duplicate", onClick: () => duplicateExperiment(row), icon: <Copy className="h-4 w-4" />, disabled: duplicatingId === row.id },
            { label: "Export", onClick: () => exportExperiment(row), icon: <FileJson className="h-4 w-4" /> },
            { dividerAfter: true, label: "", onClick: () => {}, disabled: true },
            { label: "Delete", onClick: () => setDeleteTarget(row), icon: <Trash2 className="h-4 w-4" />, danger: true },
          ]}
          align="right"
        />
      </div>
    )},
  ];

  const stats = [
    { label: "Total Experiments", value: experiments.length, icon: FlaskConical, bg: "bg-[#C8A96E]/15", text: "text-[#C8A96E]" },
    { label: "Running", value: experiments.filter((e) => e.status === "running").length, icon: Loader2, bg: "bg-sky-500/15", text: "text-sky-400" },
    { label: "Completed", value: experiments.filter((e) => e.status === "completed").length, icon: CheckCircle, bg: "bg-emerald-500/15", text: "text-emerald-400" },
    { label: "Failed", value: experiments.filter((e) => e.status === "failed").length, icon: AlertTriangle, bg: "bg-red-500/15", text: "text-red-400" },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title="Experiments"
        description="Run and monitor evaluation experiments across models and datasets"
        action={
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateOpen(true)}>
            Create Experiment
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card variant="elevated" className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-400">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.text}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card variant="elevated" className="p-4 mb-6 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#C8A96E]/20 to-[#8B6A43]/10 border border-[#C8A96E]/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-[#C8A96E]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-0.5">AI Insight</p>
            {(() => {
              const best = experiments
                .filter((e) => e.status === "completed" && typeof e.metrics?.accuracy === "number")
                .sort((a, b) => (b.metrics?.accuracy ?? 0) - (a.metrics?.accuracy ?? 0))[0];
              const acc = best?.metrics?.accuracy ?? 0;
              if (best) {
                return (
                  <p className="text-sm text-foreground">
                    Best result so far: <span className="font-semibold text-[#C8A96E]">{formatPercent(acc)}</span> accuracy â€”{" "}
                    <Link href={`/experiments/${encodeURIComponent(best.id)}`} className="underline decoration-[#C8A96E]/40 hover:text-[#C8A96E]">{best.name}</Link>.{" "}
                    Re-run it with more models to find your leader.
                  </p>
                );
              }
              if (experiments.length > 0) {
                return <p className="text-sm text-stone-400">Runs are warming up â€” completed experiments get automatic winner, cost and trend insights here.</p>;
              }
              return (
                <p className="text-sm text-stone-400">
                  No experiments yet. <Link href="/experiments/new" className="text-[#C8A96E] hover:underline">Create one</Link> to get AI-ranked accuracy, cost &amp; trend insights instantly.
                </p>
              );
            })()}
          </div>
        </Card>

        <Section>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Search experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto py-2 px-3"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {loadError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => loadExperiments()}>Retry</Button>
            </div>
          )}

          <Table
            columns={columns}
            data={filteredExperiments}
            keyExtractor={(row) => row.id}
            hoverable={true}
            loading={loading}
            emptyMessage="No experiments found. Create your first experiment to get started."
          />
        </Section>
      </PageContainer>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Experiment"
        description="Configure a new evaluation experiment"
        size="xl"
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-medium text-foreground mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Experiment Name *" placeholder="e.g., Q4 Customer Support Benchmark" value={createName} onChange={(e) => setCreateName(e.target.value)} />
              <Input label="Description (optional)" placeholder="Describe the purpose of this experiment" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-4">Dataset Selection</h4>
            {datasetsLoading ? (
              <div className="p-6 text-center text-sm text-stone-500">Loading datasetsâ€¦</div>
            ) : datasets.length === 0 ? (
              <div className="p-6 rounded-lg border border-[#2A2A28] flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-6 w-6 text-amber-400" />
                <p className="text-sm text-stone-400">You have no datasets yet. Create or upload one first â€” experiments run against an evaluation dataset.</p>
                <Link href="/datasets"><Button variant="primary" size="sm" leftIcon={<Database className="h-4 w-4" />}>Go to Datasets</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {datasets.map((dataset) => {
                  const noCases = dataset.testCases === 0;
                  return (
                    <label
                      key={dataset.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition ${noCases ? "opacity-50 pointer-events-none bg-[#0F0F0F] border-[#2A2A28]" : `cursor-pointer ${createDatasetId === dataset.id ? "bg-[#C8A96E]/10 border-[#C8A96E]/30" : "border-[#2A2A28] hover:border-[#3A3A38] hover:bg-white/[0.04]"}`}`}
                    >
                      <input type="radio" name="dataset" value={dataset.id} checked={createDatasetId === dataset.id} onChange={() => setCreateDatasetId(dataset.id)} disabled={noCases} className="h-4 w-4 text-[#C8A96E] border-[#3A3A38] bg-white/[0.04] focus:ring-[#C8A96E]" />
                      <div className="h-10 w-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-stone-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{dataset.name}</p>
                        <p className="text-sm text-stone-400">{noCases ? "No test cases â€” add cases in Datasets first" : `${dataset.testCases} test cases Â· ${dataset.format.toUpperCase()} Â· ${dataset.size}`}</p>
                      </div>
                      <Badge variant={dataset.status === "ready" ? "success" : "warning"} size="sm">
                        {dataset.status}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-4">Model Selection</h4>
            {modelsLoading ? (
              <div className="p-6 text-center text-sm text-stone-500">Loading modelsâ€¦</div>
            ) : models.length === 0 ? (
              <div className="p-6 rounded-lg border border-[#2A2A28] text-center text-sm text-stone-400">No models available to select.</div>
            ) : (
              <>
                <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                  {models.filter((m) => m.status === "active" && (m as ModelConfig & { enabled?: boolean }).enabled !== false).map((model) => {
                    const isFree = model.slug === freeModel?.slug;
                    const selected = createModelIds.includes(model.slug);
                    return (
                      <label
                        key={model.id}
                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition ${selected ? "bg-[#C8A96E]/10 border-[#C8A96E]/30" : "border-[#2A2A28] hover:border-[#3A3A38] hover:bg-white/[0.04]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => setCreateModelIds((prev) => (e.target.checked ? (prev.includes(model.slug) ? prev : [...prev, model.slug]) : prev.filter((id) => id !== model.slug)))}
                          className="h-4 w-4 text-[#C8A96E] border-[#3A3A38] bg-white/[0.04] focus:ring-[#C8A96E]"
                        />
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB] flex-shrink-0">
                          {model.displayName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{model.displayName}</p>
                          <p className="text-xs text-stone-400">{model.name} Â· {model.contextLength.toLocaleString()} ctx</p>
                        </div>
                        {isFree ? (
                          <Badge variant="success" size="sm">Free</Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">${model.pricing.prompt ? model.pricing.prompt.toFixed(2) : "0"}/1M</Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-stone-500 mt-2">Free model (Dots 3 Note Preview) is pre-selected â€” costs $0 to evaluate.</p>
              </>
            )}
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-4">Prompt Configuration</h4>
            <div className="space-y-4">
              {savedPrompts.length > 0 && (
                <div>
                  <label className="label">Load Saved Prompt</label>
                  <select
                    value={createSelectedPromptId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCreateSelectedPromptId(id);
                      const p = savedPrompts.find((x) => x.id === id);
                      if (p) {
                        setCreateSystemPrompt(p.systemPrompt || createSystemPrompt);
                        setCreatePromptTemplate(p.userPrompt || createPromptTemplate);
                      }
                    }}
                    className="input"
                  >
                    <option value="">â€” Choose a saved prompt â€”</option>
                    {savedPrompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">System Prompt</label>
                <textarea value={createSystemPrompt} onChange={(e) => setCreateSystemPrompt(e.target.value)} rows={2} className="input min-h-[72px] resize-none" placeholder="You are a helpful AI assistant..." />
              </div>
              <div>
                <label className="label">Prompt Template</label>
                <textarea value={createPromptTemplate} onChange={(e) => setCreatePromptTemplate(e.target.value)} rows={3} className="input font-mono text-xs min-h-[90px] resize-none" />
                {!createPromptTemplate.includes("{{question}}") && <p className="text-xs text-red-400 mt-1">Must include {"{{question}}"} placeholder.</p>}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-4">Run Settings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label" htmlFor="create-temperature">Temperature</label>
                <Input id="create-temperature" type="number" min={0} max={2} step={0.1} value={createTemperature} onChange={(e) => setCreateTemperature(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="create-max-tokens">Max Tokens</label>
                <Input id="create-max-tokens" type="number" min={1} step={1} value={createMaxTokens} onChange={(e) => setCreateMaxTokens(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="create-judge">Judge Model</label>
                <select id="create-judge" className="input" value={createJudgeModel} onChange={(e) => setCreateJudgeModel(e.target.value)}>
                  <option value="openrouter/free">Free Router ($0)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (Faster)</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A28]">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateNew}
              isLoading={creating}
              disabled={datasets.length === 0}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {datasets.length === 0 ? "Create a Dataset First" : "Create Experiment"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Experiment"
        description={`Update ${editTarget?.name || "this experiment"}`}
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-medium text-foreground mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Experiment Name *" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input label="Description (optional)" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Describe the purpose of this experiment" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A28]">
            <Button variant="ghost" type="button" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit} isLoading={savingEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteExperiment}
        title="Delete experiment?"
        message={`Delete â€œ${deleteTarget?.name || "this experiment"}â€? Its run history and evaluation results will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </DashboardLayout>
  );
}