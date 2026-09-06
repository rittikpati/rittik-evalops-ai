"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useToast } from "@/components/ui/Toast";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { Dropdown, DropdownTrigger } from "@/components/ui/Dropdown";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useLiveRun } from "@/hooks/useLiveRun";
import { RunLiveCard } from "@/components/runs/RunLiveCard";
import {
  BarChartComponent,
  LineChartComponent,
  ScatterChartComponent,
  MetricCard,
} from "@/components/charts/ChartComponents";
import { getModelById } from "@/lib/ai/models";
import { runTrend, modelDeltas, pickBest, pickBestValue } from "@/lib/experiments/smart";
import type { EvaluationRun } from "@/lib/evaluations/types";
import type { Experiment } from "@/types";
import {
  Play,
  RotateCw,
  Download,
  Share2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Clock,
  Database,
  Cpu,
  DollarSign,
  Target,
  Shield,
  AlertCircle,
  ArrowUpRight,
  BarChart2,
  Eye,
  ExternalLink,
  Edit,
  Trash2,
  Copy,
  FileCsv,
  ListChecks,
  ShieldAlert,
  Scale,
} from "@/components/layout/Icons";
import { formatNumber, formatCurrency, formatPercent, formatRelativeTime, formatDuration } from "@/frontend/lib/utils";

type ResultRow = EvaluationRun["results"][number];

export default function ExperimentDetailPage() {
  const params = useParams();
  const experimentId = params.id as string;
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [rerunProviderKind, setRerunProviderKind] = useState<"auto" | "mock">("auto");
  const [datasetsExists, setDatasetsExists] = useState<Record<string, boolean>>({});
  const [datasetsInfoLoaded, setDatasetsInfoLoaded] = useState(false);

  const liveRun = useLiveRun();
  const running = liveRun.state.phase === "connecting" || liveRun.state.phase === "running";

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [resultFilter, setResultFilter] = useState("all");
  const [resultStatusFilter, setResultStatusFilter] = useState<"all" | "success" | "error">("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editPromptTemplate, setEditPromptTemplate] = useState("");
  const [editTemperature, setEditTemperature] = useState("0.7");
  const [editMaxTokens, setEditMaxTokens] = useState("512");
  const [editJudgeModelId, setEditJudgeModelId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const configOf = (exp: Experiment) => exp as Experiment & {
    systemPrompt?: string;
    promptTemplate?: string;
    temperature?: number;
    maxTokens?: number;
    judgeModelId?: string;
  };

  const openEdit = () => {
    if (!experiment) return;
    const cfg = configOf(experiment);
    setEditName(experiment.name);
    setEditDescription(experiment.description || "");
    setEditSystemPrompt(cfg.systemPrompt || "");
    setEditPromptTemplate(cfg.promptTemplate || "Answer {{question}}");
    setEditTemperature(String(cfg.temperature ?? 0.7));
    setEditMaxTokens(String(cfg.maxTokens ?? 512));
    setEditJudgeModelId(cfg.judgeModelId || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!experiment) return;
    if (!editName.trim()) {
      toastError("Name required", "Experiment name cannot be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(experiment.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription,
          systemPrompt: editSystemPrompt,
          promptTemplate: editPromptTemplate,
          temperature: Number(editTemperature) || 0.7,
          maxTokens: Number(editMaxTokens) || 512,
          judgeModelId: editJudgeModelId,
        }),
      });
      const j = await res.json();
      if (j.status === "success" && j.experiment) {
        success("Experiment updated", `${j.experiment.name} saved.`);
        setEditOpen(false);
        load();
      } else {
        toastError("Update failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Update failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setSavingEdit(false);
    }
  };

  const duplicate = async () => {
    if (!experiment) return;
    if (experiment.status === "running") {
      toastError("Run in progress", "Wait for the active run to finish before duplicating.");
      return;
    }
    const cfg = configOf(experiment);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${experiment.name} (Copy)`,
          description: experiment.description,
          datasetId: experiment.datasetId,
          modelIds: experiment.models,
          systemPrompt: cfg.systemPrompt,
          promptTemplate: cfg.promptTemplate,
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          judgeModelId: cfg.judgeModelId,
        }),
      });
      const j = await res.json();
      if (j.status === "success" && j.experiment) {
        success("Experiment duplicated", `${j.experiment.name} created â€” runs were not copied.`);
      } else {
        toastError("Duplicate failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Duplicate failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  // Row-level metric keys exported for every persisted result. Order is stable
  // so CSV/JSON columns stay consistent across exports.
  const exportMetricKeys = ["accuracy", "faithfulness", "relevance", "hallucination", "completeness", "toxicity", "bias", "safety"] as const;

  // Flatten persisted run results into export rows (model, test case, status,
  // answer, expected answer, metrics, latency, cost, tokens). Uses only the real
  // stored values for the current experiment's runs.
  const buildExportRows = (runResults: EvaluationRun["results"]) =>
    runResults.map((r) => ({
      model: r.model,
      testCase: r.testCaseId,
      status: r.status,
      answer: r.output,
      expectedAnswer: r.expectedOutput || null,
      ...(Object.fromEntries(exportMetricKeys.map((k) => [k, r.scores?.[k] ?? null])) as Record<string, number | null>),
      latencyMs: r.status === "success" ? r.latency : null,
      cost: r.estimatedCost,
      totalTokens: r.totalTokens,
    }));

  const exportExperimentResults = async (format: "json" | "csv") => {
    if (!experiment) return;
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(experiment.id)}`);
      const j = await res.json();
      if (j.status !== "success") {
        toastError("Export failed", j.error || "Unknown");
        return;
      }
      const runs = Array.isArray(j.runs) ? (j.runs as EvaluationRun[]) : [];
      const slug = experiment.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "experiment";
      const base = `${slug}-${experiment.id}`;

      let body: string;
      let type: string;
      if (format === "csv") {
        const rows = runs.flatMap((run) => buildExportRows(run.results));
        const columns = ["model", "testCase", "status", "answer", "expectedAnswer", ...exportMetricKeys, "latencyMs", "cost", "totalTokens"];
        const esc = (v: string | number | null) => {
          const s = v === null ? "" : String(v);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        body = [columns.join(","), ...rows.map((row) => columns.map((c) => esc(row[c as keyof typeof row])).join(","))].join("\n");
        type = "text/csv;charset=utf-8;";
      } else {
        body = JSON.stringify({ experiment: j.experiment, runs, exportedAt: new Date().toISOString() }, null, 2);
        type = "application/json";
      }

      const blob = new Blob([body], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.${format === "csv" ? "csv" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success("Export complete", `Experiment results downloaded as ${format.toUpperCase()}.`);
    } catch (e) {
      toastError("Export failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const confirmDelete = async () => {
    if (!experiment) return;
    if (experiment.status === "running") {
      setDeleteOpen(false);
      toastError("Run in progress", "Wait for the active run to finish before deleting.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/experiments/${encodeURIComponent(experiment.id)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.status === "success") {
        success("Experiment deleted", `${experiment.name} was removed.`);
        setDeleteOpen(false);
        router.push("/experiments");
      } else {
        toastError("Delete failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Delete failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setDeleting(false);
    }
  };

  const load = () => {
    fetch(`/api/experiments/${encodeURIComponent(experimentId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && j.experiment) {
          setExperiment(j.experiment);
          setRuns(Array.isArray(j.runs) ? (j.runs as EvaluationRun[]) : []);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId]);

  // Track live dataset existence so the page can warn when the experiment's
  // dataset has been deleted (run would fail with DATASET_NOT_FOUND).
  useEffect(() => {
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, boolean> = {};
        if (j.status === "success" && Array.isArray(j.datasets)) {
          for (const d of j.datasets as Array<{ id: string }>) map[d.id] = true;
        }
        setDatasetsExists(map);
      })
      .catch(() => {})
      .finally(() => setDatasetsInfoLoaded(true));
  }, []);

  const latestRun = runs[0];
  const statusConfig: Record<string, { variant: "neutral" | "info" | "success" | "danger"; label: string; icon: React.ReactNode }> = {
    draft: { variant: "neutral", label: "Draft", icon: <span className="h-3 w-3 rounded bg-white/20" /> },
    running: { variant: "info", label: "Running", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { variant: "success", label: "Completed", icon: <CheckCircle className="h-3 w-3" /> },
    failed: { variant: "danger", label: "Failed", icon: <AlertTriangle className="h-3 w-3" /> },
    cancelled: { variant: "neutral", label: "Cancelled", icon: <X className="h-3 w-3" /> },
  };
  const config = statusConfig[experiment?.status ?? "draft"] ?? statusConfig.draft;

  const overviewMetrics = useMemo(() => {
    const res = latestRun?.results ?? [];
    const ok = res.filter((r) => r.status === "success");
    const n = ok.length;
    const avg = (key: keyof NonNullable<ResultRow["scores"]>) => {
      const vals = ok.map((r) => r.scores?.[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : undefined;
    };
    const agg = latestRun?.aggregated ?? [];
    const aggAccuracy = agg.length ? agg.reduce((s, a) => s + a.avgAccuracy, 0) / agg.length : undefined;
    const avgLatency = n ? ok.reduce((s, r) => s + r.latency, 0) / n : undefined;
    const totalCost = res.reduce((s, r) => s + (r.estimatedCost || 0), 0);
    const m = experiment?.metrics;
    return {
      accuracy: aggAccuracy ?? avg("accuracy") ?? m?.accuracy,
      faithfulness: avg("faithfulness") ?? m?.faithfulness,
      relevance: avg("relevance") ?? m?.relevance,
      hallucination: avg("hallucination") ?? m?.hallucination,
      completeness: avg("completeness") ?? m?.completeness,
      toxicity: avg("toxicity") ?? m?.toxicity,
      bias: avg("bias") ?? m?.bias,
      latency: avgLatency ?? m?.latency,
      cost: totalCost || m?.cost,
      safety: avg("safety") ?? m?.safety,
      cases: n || experiment?.completedTestCases,
    };
  }, [latestRun, experiment]);

  const modelNames = useMemo(() => Array.from(new Set(runs.flatMap((r) => r.results.map((x) => x.model)))), [runs]);

  const resultStatusFilterOptions: Array<{ value: "all" | "success" | "error"; label: string }> = [
    { value: "all", label: "All" },
    { value: "success", label: "Succeeded" },
    { value: "error", label: "Failed" },
  ];
  const filteredResults = (() => {
    const base = latestRun?.results ?? [];
    const step2 =
      resultStatusFilter === "all" ? base : base.filter((r) => r.status === resultStatusFilter);
    return resultFilter === "all" ? step2 : step2.filter((r) => r.model === resultFilter);
  })();

  const comparisonRows = useMemo(() => {
    const map = new Map<string, ResultRow[]>();
    (latestRun?.results ?? []).forEach((r) => {
      const list = map.get(r.model) || [];
      list.push(r);
      map.set(r.model, list);
    });
    const rows = Array.from(map.entries()).map(([model, list]) => {
      const ok = list.filter((r) => r.status === "success");
      const n = ok.length;
      // Missing / insufficient results are NEVER reported as 0 â€” they stay
      // null and render as "â€”", so a failed-only model is not misrepresented.
      const avg = (key: keyof NonNullable<ResultRow["scores"]>): number | null => {
        if (n === 0) return null;
        const vals = ok.map((r) => r.scores?.[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      };
      const mc = getModelById(model);
      return {
        modelId: model,
        modelName: mc?.displayName || model,
        provider: mc?.provider || "â€”",
        accuracy: avg("accuracy"),
        faithfulness: avg("faithfulness"),
        relevance: avg("relevance"),
        hallucination: avg("hallucination"),
        completeness: avg("completeness"),
        toxicity: avg("toxicity"),
        bias: avg("bias"),
        latency: n ? ok.reduce((s, r) => s + r.latency, 0) / n : null,
        cost: list.reduce((s, r) => s + (r.estimatedCost || 0), 0),
        safety: avg("safety"),
        successRate: list.length ? ok.length / list.length : 0,
      };
    });
    return rows.sort((a, b) => {
      const av = a.accuracy;
      const bv = b.accuracy;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [latestRun]);

  const scatterData = comparisonRows
    .filter((r) => r.accuracy !== null && r.cost > 0)
    .map((r) => ({
      cost: Number(r.cost.toFixed(4)),
      quality: r.accuracy as number,
      size: Math.max(4, Math.round(Math.max(0, r.successRate) * 20)),
      model: (r.modelName.split(" ")[0] || r.modelName).replace(/[^a-z0-9]/gi, ""),
    }));
  const latencyData = comparisonRows
    .filter((r) => r.latency !== null)
    .map((r) => ({ model: r.modelName.split(" ")[0] || r.modelName, latency: Number(((r.latency as number) / 1000).toFixed(2)) }));
  const overviewChartData = comparisonRows.map((r) => ({
    model: r.modelName.split(" ")[0] || r.modelName,
    accuracy: r.accuracy,
    faithfulness: r.faithfulness,
    relevance: r.relevance,
  }));

  const trendData = useMemo(() => runTrend(runs), [runs]);
  const deltas = useMemo(() => modelDeltas(runs, (m) => getModelById(m)?.displayName || m), [runs]);
  const deltaMap = useMemo(() => new Map(deltas.map((d) => [d.modelId, d])), [deltas]);
  const insightRows = useMemo(
    () => comparisonRows.map((r) => ({ modelId: r.modelId, displayName: r.modelName, accuracy: r.accuracy, cost: r.cost })),
    [comparisonRows]
  );
  const best = useMemo(() => pickBest(insightRows), [insightRows]);
  const bestValue = useMemo(() => pickBestValue(insightRows), [insightRows]);
  const latestDelta = useMemo(() => {
    if (runs.length < 2) return null;
    const acc = (r: EvaluationRun) => {
      const ok = r.results.filter((x) => x.status === "success" && typeof x.scores?.accuracy === "number" && Number.isFinite(x.scores.accuracy));
      return ok.length ? ok.reduce((s, x) => s + (x.scores!.accuracy as number), 0) / ok.length : 0;
    };
    const sorted = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const prev = acc(sorted[sorted.length - 2]);
    const latest = acc(sorted[sorted.length - 1]);
    return { latest, prev, delta: latest - prev };
  }, [runs]);

  const tabs: TabItem[] = [
    { value: "overview", label: "Overview", icon: <BarChart2 className="h-4 w-4" /> },
    { value: "results", label: "Results", icon: <Eye className="h-4 w-4" /> },
    { value: "comparison", label: "Comparison", icon: <ChevronLeft className="h-4 w-4" /> },
    { value: "runs", label: "Run History", icon: <Clock className="h-4 w-4" /> },
    { value: "evaluations", label: "Evaluations", icon: <Target className="h-4 w-4" /> },
  ];

  const resultColumns: Column<ResultRow>[] = [
    { key: "input", header: "Question", width: "300px", render: (_, row) => (
      <div className="max-w-xs">
        <p className="font-medium text-foreground line-clamp-2">{row.input}</p>
      </div>
    )},
    { key: "model", header: "Model", width: "120px", render: (_, row) => (
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
          {(getModelById(row.model)?.displayName || row.model).charAt(0)}
        </div>
        <span className="text-stone-300">{getModelById(row.model)?.displayName || row.model}</span>
      </div>
    )},
    { key: "status", header: "Status", render: (_, row) => (
      <Badge variant={row.status === "success" ? "success" : "danger"} size="sm">{row.status === "success" ? "OK" : "Error"}</Badge>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => (
      <span className="font-mono tabular-nums font-semibold">{row.scores?.accuracy !== undefined ? formatPercent(row.scores.accuracy) : "â€”"}</span>
    )},
    { key: "faithfulness", header: "Faithfulness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.faithfulness !== undefined ? formatPercent(row.scores.faithfulness) : "â€”"}</span>
    )},
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      const h = row.scores?.hallucination;
      if (h === undefined || h === null) return <span className="text-stone-500">â€”</span>;
      // 1 = no hallucination, 0 = severe. Higher is better.
      return (
        <Badge variant={h >= 0.85 ? "success" : h >= 0.7 ? "warning" : "danger"} size="sm">{formatPercent(h)}</Badge>
      );
    }},
    { key: "completeness", header: "Completeness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.completeness !== undefined && row.scores?.completeness !== null ? formatPercent(row.scores.completeness) : "â€”"}</span>
    )},
    { key: "toxicity", header: "Toxicity", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.toxicity !== undefined && row.scores?.toxicity !== null ? formatPercent(row.scores.toxicity) : "â€”"}</span>
    )},
    { key: "bias", header: "Bias", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.bias !== undefined && row.scores?.bias !== null ? formatPercent(row.scores.bias) : "â€”"}</span>
    )},
    { key: "latency", header: "Latency", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.status === "success" ? `${(row.latency / 1000).toFixed(2)}s` : "â€”"}</span>
    )},
    { key: "cost", header: "Cost", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.status === "success" ? formatCurrency(row.estimatedCost || 0) : "â€”"}</span>
    )},
    { key: "actions", header: "", render: (_, row) => (
      <button
        className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth"
        onClick={() => setSelectedResult(row)}
        aria-label="View evaluation details"
      >
        <Eye className="h-4 w-4" />
      </button>
    )},
  ];

  const comparisonColumns: Column<(typeof comparisonRows)[number]>[] = [
    { key: "rank", header: "#", width: "50px", render: (_, row, index) => (
      <span className={`font-bold ${index === 0 ? "text-accent-400" : "text-stone-300"}`}>{index + 1}</span>
    )},
    { key: "modelName", header: "Model", render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
          {row.modelName.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-foreground">{row.modelName}</p>
          <p className="text-xs text-stone-400">{row.provider}</p>
        </div>
      </div>
    )},
    { key: "successRate", header: "Success", render: (_, row) => (
      <span className="font-mono tabular-nums">{formatPercent(row.successRate)}</span>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => (
      <span className="font-mono tabular-nums font-semibold">{row.accuracy !== null ? formatPercent(row.accuracy) : "â€”"}</span>
    )},
    { key: "delta", header: "Î” vs prev", render: (_, row) => {
      const d = deltaMap.get(row.modelId);
      if (!d || d.delta === null) return <span className="text-stone-600">â€”</span>;
      return (
        <span className={`font-mono tabular-nums ${d.delta >= 0 ? "text-emerald-400" : "text-red-400"}`} title={`${d.episodes} run(s) â€” latest ${formatPercent(d.latest ?? 0)}, previous ${formatPercent(d.previous ?? 0)}`}>
          {d.delta >= 0 ? "â–²" : "â–¼"} {formatPercent(Math.abs(d.delta))}
        </span>
      );
    }},
    { key: "faithfulness", header: "Faithfulness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.faithfulness !== null ? formatPercent(row.faithfulness) : "â€”"}</span>
    )},
    { key: "relevance", header: "Relevance", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.relevance !== null ? formatPercent(row.relevance) : "â€”"}</span>
    )},
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      const h = row.hallucination;
      if (h === null) return <span className="text-stone-500">â€”</span>;
      // 1 = no hallucination, 0 = severe. Higher is better.
      return (
        <Badge variant={h >= 0.85 ? "success" : h >= 0.7 ? "warning" : "danger"} size="sm">{formatPercent(h)}</Badge>
      );
    }},
    { key: "completeness", header: "Completeness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.completeness !== null && row.completeness !== undefined ? formatPercent(row.completeness) : "â€”"}</span>
    )},
    { key: "toxicity", header: "Toxicity", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.toxicity !== null && row.toxicity !== undefined ? formatPercent(row.toxicity) : "â€”"}</span>
    )},
    { key: "bias", header: "Bias", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.bias !== null && row.bias !== undefined ? formatPercent(row.bias) : "â€”"}</span>
    )},
    { key: "latency", header: "Latency", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.latency !== null ? `${(row.latency / 1000).toFixed(1)}s` : "â€”"}</span>
    )},
    { key: "cost", header: "Cost", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{formatCurrency(row.cost)}</span>
    )},
    { key: "safety", header: "Safety", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.safety !== null ? formatPercent(row.safety) : "â€”"}</span>
    )},
  ];

  const runColumns: Column<EvaluationRun>[] = [
    { key: "id", header: "Run", width: "170px", render: (_, row) => (
      <Link href={`/runs/${row.id}`} className="flex items-center gap-2 font-mono text-xs text-accent-400 hover:text-accent-300 transition-smooth">
        <ExternalLink className="h-3.5 w-3.5" /> {row.id.slice(0, 20)}
      </Link>
    )},
    { key: "status", header: "Status", render: (_, row) => (
      <Badge variant={row.status === "completed" ? "success" : row.status === "running" ? "info" : row.status === "partial" ? "warning" : "danger"} dot size="sm">
        {row.status}
      </Badge>
    )},
    { key: "mode", header: "Mode", render: (_, row) => (
      row.mode === "mock"
        ? <Badge variant="warning" size="sm" title="Synthetic demo results â€” not a real model evaluation">mock</Badge>
        : <Badge variant="success" size="sm" title="Real evaluation via OpenRouter">live</Badge>
    )},
    { key: "models", header: "Models", width: "110px", render: (_, row) => (
      <Badge variant="neutral" size="sm">{row.modelIds.length} model{row.modelIds.length === 1 ? "" : "s"}</Badge>
    )},
    { key: "cases", header: "Cases", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.results.length ? Math.round(row.results.length / Math.max(1, row.modelIds.length)) : (row.total ? Math.round(row.total / Math.max(1, row.modelIds.length)) : 0)}</span>
    )},
    { key: "total", header: "Results", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.results.filter((r) => r.status === "success").length}<span className="text-stone-600">/{row.results.length}</span></span>
    )},
    { key: "failed", header: "Failed", render: (_, row) => {
      const failed = row.results.length - row.results.filter((r) => r.status === "success").length;
      if (failed === 0) return <span className="text-stone-600">â€”</span>;
      const first = row.errors?.[0];
      return (
        <span className="text-danger-400 text-xs" title={first ? `${first.code ? `[${first.code}] ` : ""}${getModelById(first.modelId)?.displayName || first.modelId}: ${first.message}` : ""}>
          {failed}{first ? ` Â· ${getModelById(first.modelId)?.displayName || first.modelId}` : ""}
        </span>
      );
    }},
    { key: "accuracy", header: "Accuracy", render: (_, row) => {
      const scored = (row.results ?? []).filter((r) => r.status === "success" && typeof r.scores?.accuracy === "number" && Number.isFinite(r.scores.accuracy));
      const acc = scored.length ? scored.reduce((s, r) => s + (r.scores!.accuracy as number), 0) / scored.length : null;
      return <span className="font-mono tabular-nums font-semibold">{acc !== null ? formatPercent(acc) : "â€”"}</span>;
    }},
    { key: "completeness", header: "Completeness", render: (_, row) => {
      const scored = (row.results ?? []).filter((r) => r.status === "success" && typeof r.scores?.completeness === "number" && Number.isFinite(r.scores.completeness));
      const v = scored.length ? scored.reduce((s, r) => s + (r.scores!.completeness as number), 0) / scored.length : null;
      return <span className="font-mono tabular-nums">{v !== null ? formatPercent(v) : "â€”"}</span>;
    }},
    { key: "toxicity", header: "Toxicity", render: (_, row) => {
      const scored = (row.results ?? []).filter((r) => r.status === "success" && typeof r.scores?.toxicity === "number" && Number.isFinite(r.scores.toxicity));
      const v = scored.length ? scored.reduce((s, r) => s + (r.scores!.toxicity as number), 0) / scored.length : null;
      return <span className="font-mono tabular-nums">{v !== null ? formatPercent(v) : "â€”"}</span>;
    }},
    { key: "bias", header: "Bias", render: (_, row) => {
      const scored = (row.results ?? []).filter((r) => r.status === "success" && typeof r.scores?.bias === "number" && Number.isFinite(r.scores.bias));
      const v = scored.length ? scored.reduce((s, r) => s + (r.scores!.bias as number), 0) / scored.length : null;
      return <span className="font-mono tabular-nums">{v !== null ? formatPercent(v) : "â€”"}</span>;
    }},
    { key: "cost", header: "Cost", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{formatCurrency(row.results.reduce((s, r) => s + (r.estimatedCost || 0), 0))}</span>
    )},
    { key: "startedAt", header: "Started", render: (_, row) => (
      <span className="text-stone-400">{formatRelativeTime(row.startedAt)}</span>
    )},
    { key: "createdAt", header: "Created", render: (_, row) => (
      <span className="text-stone-500 text-xs">{row.createdAt ? formatRelativeTime(row.createdAt) : "â€”"}</span>
    )},
    { key: "duration", header: "Duration", render: (_, row) => {
      if (row.status === "running" || !row.completedAt) return <span className="text-stone-500">â€”</span>;
      const ms = new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime();
      return <span className="font-mono tabular-nums text-stone-500">{ms > 0 ? formatDuration(ms) : "â€”"}</span>;
    }},
  ];

  const runLogs = useMemo(() => {
    return runs.flatMap((run) => [
      { time: run.startedAt, text: `Run ${run.id.slice(0, 14)} started â€” dataset "${run.datasetName}", models: ${run.modelNames.join(", ")}`, level: "INFO" },
      { time: run.completedAt || run.createdAt, text: `Run ${run.id.slice(0, 14)} finished â€” ${run.results.filter((r) => r.status === "success").length}/${run.results.length} succeeded (${run.status})`, level: run.status === "failed" ? "ERROR" : "INFO" },
      ...run.errors.map((e) => ({ time: run.completedAt || run.createdAt, text: `[${e.modelId}] case ${e.testCaseId}: ${e.message}`, level: "WARN" })),
    ]);
  }, [runs]);

  const launch = async () => {
    if (!experiment || running) return;
    if (experiment.status === "running") {
      toastError("Run already in progress", "This experiment has an active run. Wait for it to finish before starting another.");
      return;
    }
    setShowLive(true);
    liveRun.reset();
    await liveRun.start({
      experimentId: experiment.id,
      datasetId: experiment.datasetId,
      modelIds: experiment.models,
      providerKind: rerunProviderKind,
      systemPrompt: (experiment as { systemPrompt?: string }).systemPrompt,
      userPrompt: (experiment as { promptTemplate?: string }).promptTemplate || "Answer {{question}}",
      temperature: (experiment as { temperature?: number }).temperature,
      maxTokens: (experiment as { maxTokens?: number }).maxTokens,
      judgeModelId: (experiment as { judgeModelId?: string }).judgeModelId,
    });
  };

  // On live completion, refresh the persisted data and surface the outcome
  useEffect(() => {
    if (!showLive) return;
    if (liveRun.state.phase === "done" && liveRun.state.final) {
      const f = liveRun.state.final;
      if (f.failed > 0 && f.successful > 0) {
        success("Run partially completed", `${f.successful}/${f.total} succeeded â€” ${f.failed} failed`);
      } else if (f.failed === 0) {
        success("Run completed", `${f.successful}/${f.total} succeeded`);
      } else {
        toastError("Run failed", "No test case could be executed successfully.");
      }
      load();
      setActiveTab("results");
    } else if (liveRun.state.phase === "error") {
      toastError("Evaluation failed", (liveRun.state.error || "Run could not be started").slice(0, 140));
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRun.state.phase, showLive]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer title="Experiment" description="Loadingâ€¦">
          <Card className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading experimentâ€¦</p>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (notFound || !experiment) {
    return (
      <DashboardLayout>
        <PageContainer title="Experiment Not Found" description="No experiment matches this id in the in-memory store.">
          <Card className="p-12 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />
            <p className="text-foreground font-medium">Experiment <span className="font-mono text-accent-400">{experimentId}</span> was not found.</p>
            <div className="flex justify-center gap-2">
              <Link href="/experiments"><Button variant="primary" leftIcon={<ChevronLeft className="h-4 w-4" />}>Back to Experiments</Button></Link>
              <Link href="/experiments/new"><Button variant="ghost">New Experiment</Button></Link>
            </div>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const cfg = configOf(experiment);

  const metricCards: Array<{ label: string; value: string; ago: number; icon: React.ReactNode }> = [
    { label: "Accuracy", value: overviewMetrics.accuracy !== undefined ? formatPercent(overviewMetrics.accuracy) : "â€”", ago: 0, icon: <Target className="h-5 w-5" /> },
    { label: "Faithfulness", value: overviewMetrics.faithfulness !== undefined ? formatPercent(overviewMetrics.faithfulness) : "â€”", ago: 0, icon: <Shield className="h-5 w-5" /> },
    { label: "Hallucination", value: overviewMetrics.hallucination !== undefined ? formatPercent(overviewMetrics.hallucination) : "â€”", ago: 0, icon: <AlertCircle className="h-5 w-5" /> },
    { label: "Completeness", value: overviewMetrics.completeness !== undefined ? formatPercent(overviewMetrics.completeness) : "â€”", ago: 0, icon: <ListChecks className="h-5 w-5" /> },
    { label: "Toxicity", value: overviewMetrics.toxicity !== undefined ? formatPercent(overviewMetrics.toxicity) : "â€”", ago: 0, icon: <ShieldAlert className="h-5 w-5" /> },
    { label: "Bias", value: overviewMetrics.bias !== undefined ? formatPercent(overviewMetrics.bias) : "â€”", ago: 0, icon: <Scale className="h-5 w-5" /> },
    { label: "Avg Latency", value: overviewMetrics.latency !== undefined ? `${(overviewMetrics.latency / 1000).toFixed(1)}s` : "â€”", ago: 0, icon: <Clock className="h-5 w-5" /> },
    { label: "Total Cost", value: overviewMetrics.cost !== undefined ? formatCurrency(overviewMetrics.cost) : "â€”", ago: 0, icon: <DollarSign className="h-5 w-5" /> },
    { label: "Safety", value: overviewMetrics.safety !== undefined ? formatPercent(overviewMetrics.safety) : "â€”", ago: 0, icon: <CheckCircle className="h-5 w-5" /> },
    { label: "Relevance", value: overviewMetrics.relevance !== undefined ? formatPercent(overviewMetrics.relevance) : "â€”", ago: 0, icon: <ArrowUpRight className="h-5 w-5" /> },
    { label: "Test Cases", value: formatNumber(overviewMetrics.cases ?? 0), ago: 0, icon: <Database className="h-5 w-5" /> },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title={experiment.name}
        description={experiment.description || "No description"}
        action={
          <div className="flex items-center gap-2">
            {(experiment.status === "draft" || experiment.status === "failed" || experiment.status === "completed") && (
              <div className="flex items-center gap-0.5 rounded-lg border border-[#2A2A28] bg-[#0F0F0F] p-0.5">
                {([{ v: "auto", l: "Real" }, { v: "mock", l: "Mock" }] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    title={o.v === "mock" ? "Run offline with deterministic simulated answers (never blocked by credits/rate limits)" : "Run against the configured real provider"}
                    onClick={() => setRerunProviderKind(o.v)}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition ${
                      rerunProviderKind === o.v ? "bg-[#C8A96E] text-[#0F0F0F]" : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            )}
            {experiment.status === "draft" && (
              <Button variant="primary" size="sm" onClick={launch} isLoading={running} leftIcon={<Play className="h-3.5 w-3.5" />}>Run Experiment</Button>
            )}
            {experiment.status === "failed" && (
              <Button variant="primary" size="sm" onClick={launch} isLoading={running} leftIcon={<RotateCw className="h-3.5 w-3.5" />}>Retry</Button>
            )}
            {(experiment.status === "completed" || (runs.length > 0 && experiment.status === "draft")) && (
              <Button variant="primary" size="sm" onClick={launch} isLoading={running} leftIcon={<RotateCw className="h-3.5 w-3.5" />}>Run Again</Button>
            )}
            {experiment.status === "completed" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => exportExperimentResults("json")} leftIcon={<Download className="h-3.5 w-3.5" />}>Export JSON</Button>
                <Button variant="ghost" size="sm" onClick={() => exportExperimentResults("csv")} leftIcon={<FileCsv className="h-3.5 w-3.5" />}>Export CSV</Button>
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); success("Link copied", "Experiment link copied."); }} leftIcon={<Share2 className="h-3.5 w-3.5" />}>Share</Button>
              </>
            )}
            <Dropdown
              trigger={
                <DropdownTrigger variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </DropdownTrigger>
              }
              items={[
                { label: "Edit Experiment", onClick: openEdit, icon: <Edit className="h-4 w-4" /> },
                { label: "Duplicate", onClick: duplicate, icon: <Copy className="h-4 w-4" /> },
                { label: "Export Results (CSV)", onClick: () => exportExperimentResults("csv"), icon: <FileCsv className="h-4 w-4" /> },
                { dividerAfter: true, label: "", onClick: () => {}, disabled: true },
                { label: "Delete", onClick: () => setDeleteOpen(true), icon: <Trash2 className="h-4 w-4" />, danger: true },
              ]}
              align="right"
            />
          </div>
        }
      >
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={config.variant} dot size="lg">
              {config.icon} {config.label}
            </Badge>
            {experiment.startedAt && (
              <Badge variant="neutral" size="sm">
                <Clock className="h-3 w-3" /> Started {formatRelativeTime(experiment.startedAt)}
              </Badge>
            )}
            {experiment.completedAt && (
              <Badge variant="success" size="sm">
                <CheckCircle className="h-3 w-3" /> Completed {formatRelativeTime(experiment.completedAt)}
              </Badge>
            )}
            <Badge variant="info" size="sm">
              <Database className="h-3 w-3" /> {experiment.datasetName || "â€”"}
            </Badge>
            <Badge variant="neutral" size="sm">
              <Cpu className="h-3 w-3" /> {experiment.models.length} models
            </Badge>
            <Badge variant="neutral" size="sm">
              <BarChart2 className="h-3 w-3" /> {runs.length} run{runs.length === 1 ? "" : "s"}
            </Badge>
            {latestDelta && latestDelta.delta !== null && (
              <Badge variant={latestDelta.delta >= 0 ? "success" : "danger"} size="sm">
                {latestDelta.delta >= 0 ? "â–²" : "â–¼"} {formatPercent(Math.abs(latestDelta.delta))} vs previous run
              </Badge>
            )}
          </div>
        </div>

        {datasetsInfoLoaded && experiment && !datasetsExists[experiment.datasetId] && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Dataset missing</p>
              <p className="text-xs text-amber-200/70">The dataset â€œ{experiment.datasetName}â€ no longer exists. Running this experiment will fail with DATASET_NOT_FOUND â€” restore the dataset before running.</p>
            </div>
          </div>
        )}

        {showLive && liveRun.state.phase !== "idle" && (
          <div className="mb-6">
            <RunLiveCard
              state={liveRun.state}
              onViewRun={(id) => router.push(`/runs/${id}`)}
              onDismiss={() => {
                setShowLive(false);
                liveRun.reset();
              }}
              onRetry={launch}
            />
          </div>
        )}

        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} variant="pills" />

        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map((metric, index) => (
                <motion.div key={metric.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.03 }}>
                  <MetricCard {...metric} />
                </motion.div>
              ))}
            </div>

            <Card className="p-6">
              <h4 className="font-medium text-foreground mb-4">Configuration</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Dataset</p>
                  <p className="text-stone-200 truncate" title={experiment.datasetName || ""}>{experiment.datasetName || "â€”"}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Models</p>
                  <p className="text-stone-200">{experiment.models.map((m) => getModelById(m)?.displayName || m).join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Temperature</p>
                  <p className="text-stone-200 font-mono">{cfg.temperature ?? 0.7}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Max Tokens</p>
                  <p className="text-stone-200 font-mono">{cfg.maxTokens ?? 512}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Judge Model</p>
                  <p className="text-stone-200">{getModelById(cfg.judgeModelId || "")?.displayName || cfg.judgeModelId || "Default"}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Test Cases</p>
                  <p className="text-stone-200 font-mono">{experiment.totalTestCases} ({experiment.models.length} Ã— dataset)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-stone-500 mb-1">System Prompt</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-[#0F0F0F] border border-[#2A2A28] p-3 text-xs text-stone-300 max-h-40 overflow-auto">{cfg.systemPrompt || "â€”"}</pre>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Prompt Template</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-[#0F0F0F] border border-[#2A2A28] p-3 text-xs text-stone-300 max-h-40 overflow-auto">{cfg.promptTemplate || "â€”"}</pre>
                </div>
              </div>
            </Card>

            {(comparisonRows.length === 0 || (latestRun && latestRun.results.filter((r) => r.status === "success").length === 0)) ? (
              <Card className="p-12 text-center space-y-2">
                <BarChart2 className="h-8 w-8 mx-auto text-stone-600" />
                {latestRun && latestRun.results.length > 0 ? (
                  <>
                    <p className="font-medium text-foreground">No successful evaluations</p>
                    <p className="text-sm text-stone-400">All {latestRun.results.length} evaluation(s) failed. Check the Results tab and Run History for error details, then retry.</p>
                    <div className="pt-2 flex justify-center gap-2">
                      <Button variant="primary" size="sm" onClick={launch} isLoading={running} leftIcon={<RotateCw className="h-3.5 w-3.5" />}>Retry Run</Button>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("runs")} leftIcon={<Clock className="h-3.5 w-3.5" />}>View Run History</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">No results yet</p>
                    <p className="text-sm text-stone-400">Run this experiment to generate metrics, charts, and run history.</p>
                    <div className="pt-2">
                      <Button variant="primary" size="sm" onClick={launch} isLoading={running} leftIcon={<Play className="h-3.5 w-3.5" />}>Run Experiment</Button>
                    </div>
                  </>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChartComponent
                  data={overviewChartData}
                  xKey="model"
                  yKeys={["accuracy", "faithfulness", "relevance"]}
                  title="Model Performance (latest run)"
                  subtitle="Accuracy, faithfulness, and relevance scores"
                  height={350}
                />
                <LineChartComponent
                  data={comparisonRows.map((r) => ({ model: r.modelName, accuracy: r.accuracy, hallucination: r.hallucination }))}
                  xKey="model"
                  yKeys={["accuracy", "hallucination"]}
                  title="Accuracy vs Hallucination"
                  subtitle="Per-model comparison from the latest run"
                  height={350}
                  fillArea={false}
                />
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
              <Card className="lg:col-span-3 p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-foreground">Progress across runs</h4>
                    <p className="text-xs text-stone-500">Accuracy journey across every run of this experiment</p>
                  </div>
                  {latestDelta && latestDelta.delta !== null && (
                    <Badge variant={latestDelta.delta >= 0 ? "success" : "danger"} size="sm">
                      {latestDelta.delta >= 0 ? "â–²" : "â–¼"} {formatPercent(Math.abs(latestDelta.delta))} last run
                    </Badge>
                  )}
                </div>
                {trendData.length > 0 ? (
                  <LineChartComponent
                    data={trendData as unknown as Record<string, string | number | null>[]}
                    xKey="label"
                    yKeys={["accuracy"]}
                    title=""
                    height={280}
                    showLegend={false}
                  />
                ) : (
                  <p className="text-sm text-stone-500">No completed runs yet â€” the trend appears after the first run.</p>
                )}
              </Card>

              <Card className="lg:col-span-2 p-6">
                <h4 className="font-medium text-foreground mb-3">Smart insight</h4>
                {best ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3">
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
                        {best.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-emerald-200">Best performer: {best.displayName}</p>
                        <p className="text-xs text-emerald-200/70">{formatPercent(best.accuracy)} accuracy Â· {formatCurrency(best.cost)}</p>
                      </div>
                    </div>
                    {bestValue && bestValue.modelId !== best.modelId && (
                      <p className="text-stone-300">
                        Best value: <span className="font-medium text-[#F5F1EB]">{bestValue.displayName}</span> at{" "}
                        <span className="text-[#C8A96E]">{formatPercent(bestValue.accuracy)}</span> for {formatCurrency(bestValue.cost)}.
                      </p>
                    )}
                    {(() => {
                      const d = best && deltaMap.get(best.modelId);
                      if (!d || d.delta === null) return null;
                      return (
                        <p className="text-stone-300">
                          The leader {d.delta >= 0 ? "improved" : "dropped"}{" "}
                          <span className={d.delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {d.delta >= 0 ? "â–²" : "â–¼"} {formatPercent(Math.abs(d.delta))}
                          </span>{" "}
                          vs its previous run.
                        </p>
                      );
                    })()}
                    {runs.length === 1 && <p className="text-xs text-stone-500">First completed run â€” run again to compare and build a trend.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">Nobody to compare yet â€” run with multiple models to get an automatic winner and value pick.</p>
                )}
              </Card>
            </div>
          </motion.div>
        )}

        {activeTab === "results" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
            {filteredResults.length === 0 ? (
              <Card className="p-12 text-center space-y-2">
                <Eye className="h-8 w-8 mx-auto text-stone-600" />
                {(latestRun && latestRun.results.length > 0) ? (
                  <>
                    <p className="font-medium text-foreground">No results match</p>
                    <p className="text-sm text-stone-400">No results match the current filters. Try a different model or status.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">No results yet</p>
                    <p className="text-sm text-stone-400">Run {experiment.name === "unnamed" ? "the experiment" : "this experiment"} to see per-case results.</p>
                  </>
                )}
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-xl border border-[#2A2A28] bg-[#1A1A1E] p-0.5">
                    {resultStatusFilterOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setResultStatusFilter(opt.value)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${resultStatusFilter === opt.value ? "bg-[#C8A96E] text-black font-medium" : "text-stone-400 hover:text-stone-200"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
                    <option value="all">All Models</option>
                    {modelNames.map((id) => <option key={id} value={id}>{getModelById(id)?.displayName || id}</option>)}
                  </select>
                  <span className="text-xs text-stone-500">{filteredResults.length} results â€¢ click eye to expand</span>
                </div>
                <Table columns={resultColumns} data={filteredResults} keyExtractor={(row) => `${row.model}-${row.testCaseId}`} hoverable />
              </>
            )}
          </motion.div>
        )}

        {activeTab === "comparison" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            {comparisonRows.length === 0 ? (
              <Card className="p-12 text-center space-y-2">
                <BarChart2 className="h-8 w-8 mx-auto text-stone-600" />
                <p className="font-medium text-foreground">Nothing to compare yet</p>
                <p className="text-sm text-stone-400">Run the experiment with multiple models to compare them side-by-side.</p>
              </Card>
            ) : (
              <>
                <Section title="Model Comparison" description="Side-by-side comparison of evaluated models (latest run)">
                  <Table columns={comparisonColumns} data={comparisonRows} keyExtractor={(row) => row.modelId} hoverable />
                </Section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ScatterChartComponent
                    data={scatterData}
                    xKey="cost"
                    yKey="quality"
                    zKey="size"
                    labelKey="model"
                    title="Cost vs Quality (latest run)"
                    subtitle="Model cost per 1K tokens vs accuracy score"
                    xLabel="Cost per 1K tokens ($)"
                    yLabel="Accuracy Score"
                    height={350}
                  />
                  <BarChartComponent
                    data={latencyData}
                    xKey="model"
                    yKeys={["latency"]}
                    colors={["#C8A96E"]}
                    title="Latency Comparison (latest run)"
                    subtitle="Average response latency across models"
                    height={350}
                    showLegend={false}
                  />
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "runs" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Section title="Run History" description="Every execution of this experiment â€” each links to its full run detail">
              <Table columns={runColumns} data={runs} keyExtractor={(row) => row.id} hoverable emptyMessage={runs.length === 0 ? "No runs yet â€” this experiment has not been executed." : "No runs"} />
            </Section>
          </motion.div>
        )}

        {activeTab === "evaluations" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {latestRun?.aggregated.length ? (
              <Section title="Aggregated Scores" description={`Derived from run ${latestRun.id.slice(0, 20)} â€” ${latestRun.results.filter((r) => r.status === "success").length} successful evaluations`}>
                <Table columns={comparisonColumns} data={comparisonRows} keyExtractor={(row) => row.modelId} hoverable />
              </Section>
            ) : (
              <Card className="p-12 text-center space-y-2">
                <Target className="h-8 w-8 mx-auto text-stone-600" />
                <p className="font-medium text-foreground">No evaluations yet</p>
                <p className="text-sm text-stone-400">Completed runs produce aggregated judge scores per model.</p>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "logs" && runs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="font-mono text-sm text-stone-400 bg-neutral-950/50 rounded-xl p-6 max-h-[500px] overflow-auto">
            {runLogs.map((log, index) => (
              <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(index, 20) * 0.02 }} className="py-1 border-b border-[#2A2A28] last:border-0">
                <span className="text-[#C8A96E]">[{formatRelativeTime(log.time)}]</span>
                <span className={`ml-2 ${log.level === "ERROR" ? "text-danger-400" : log.level === "WARN" ? "text-amber-400" : "text-stone-400"}`}>[{log.level}]</span>
                <span className="ml-2">{log.text}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {selectedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedResult(null)}>
            <motion.div
              className="w-full max-w-3xl max-h-[90vh] overflow-auto glass-strong border border-[#2A2A28] rounded-2xl shadow-glass-strong"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#2A2A28] flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Evaluation Details</h2>
                <button onClick={() => setSelectedResult(null)} className="p-2 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-stone-400">Model</p>
                    <p className="font-medium text-foreground">{getModelById(selectedResult.model)?.displayName || selectedResult.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Status</p>
                    <Badge variant={selectedResult.status === "success" ? "success" : "danger"} size="sm">{selectedResult.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Test Case</p>
                    <p className="font-mono text-sm text-stone-300">{selectedResult.testCaseId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Cost / Latency</p>
                    <p className="font-medium text-foreground">{formatCurrency(selectedResult.estimatedCost || 0)} â€¢ {(selectedResult.latency / 1000).toFixed(2)}s</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Question</p>
                    <div className="p-4 rounded-lg bg-white/[0.04] border border-[#2A2A28]">
                      <p className="text-foreground">{selectedResult.input}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Expected Answer</p>
                    <div className="p-4 rounded-lg bg-white/[0.04] border border-[#2A2A28]">
                      <p className="text-foreground">{selectedResult.expectedOutput}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Model Answer</p>
                    <div className="p-4 rounded-lg bg-white/[0.04] border border-[#2A2A28]">
                      <p className="text-foreground">{selectedResult.output || <span className="text-stone-600 italic">No output â€” {selectedResult.error || "evaluation errored"}</span>}</p>
                    </div>
                  </div>
                  {selectedResult.error && (
                    <div>
                      <p className="text-sm text-stone-400 mb-2">Error</p>
                      <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/30">
                        {selectedResult.code && <span className="inline-block mr-2 mb-1 rounded bg-danger-500/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-danger-300">{selectedResult.code}</span>}
                        <p className="text-danger-400">{selectedResult.error}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedResult.scores && Object.keys(selectedResult.scores).length > 0 && (
                  <>
                    <div className="pt-4 border-t border-[#2A2A28]">
                      <p className="text-sm text-stone-400 mb-3">Judge Scores</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(selectedResult.scores).map(([k, v]) => (
                          <div key={k} className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]">
                            <p className="text-xs text-stone-500 capitalize">{k}</p>
                            <p className="font-mono font-semibold text-foreground">{formatPercent(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2A2A28]">
                      <MetricCard label="Tokens" value={formatNumber(selectedResult.totalTokens)} icon={<BarChart2 className="h-5 w-5" />} />
                      <MetricCard label="Prompt Tokens" value={formatNumber(selectedResult.promptTokens)} icon={<BarChart2 className="h-5 w-5" />} />
                      <MetricCard label="Completion Tokens" value={formatNumber(selectedResult.completionTokens)} icon={<BarChart2 className="h-5 w-5" />} />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </PageContainer>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Experiment"
        description={`Update ${experiment?.name || "this experiment"}`}
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

          <div>
            <h4 className="font-medium text-foreground mb-4">Prompt Configuration</h4>
            <div className="space-y-4">
              <Input label="System Prompt" value={editSystemPrompt} onChange={(e) => setEditSystemPrompt(e.target.value)} placeholder="You are a helpful assistant." />
              <Input label="Prompt Template" value={editPromptTemplate} onChange={(e) => setEditPromptTemplate(e.target.value)} placeholder="Answer {{question}}" />
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-4">Run Settings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-temperature" className="label">Temperature</label>
                <Input
                  id="edit-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={editTemperature}
                  onChange={(e) => setEditTemperature(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="edit-max-tokens" className="label">Max Tokens</label>
                <Input
                  id="edit-max-tokens"
                  type="number"
                  min={1}
                  step={1}
                  value={editMaxTokens}
                  onChange={(e) => setEditMaxTokens(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="edit-judge" className="label">Judge Model</label>
                <select
                  id="edit-judge"
                  className="input"
                  value={editJudgeModelId}
                  onChange={(e) => setEditJudgeModelId(e.target.value)}
                >
                  <option value="">Default (Free Router)</option>
                  <option value="openrouter/free">Free Router ($0)</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (Faster)</option>
                  <option value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A28]">
            <Button variant="ghost" type="button" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit} isLoading={savingEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete experiment?"
        message={`Delete â€œ${experiment?.name || "this experiment"}â€? Its run history and evaluation results will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </DashboardLayout>
  );
}