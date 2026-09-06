"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout, PageContainer } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { ModelConfig } from "@/lib/ai/models";
import {
  ChevronRight,
  ChevronLeft,
  Database,
  Cpu,
  Play,
  Check,
  Sparkles,
  Target,
  Shield,
  ArrowUpRight,
  AlertCircle,
  Clock,
  DollarSign,
  ListChecks,
  ShieldAlert,
  Scale,
  MessageSquare,
  BarChart2,
  Eye,
  CheckCircle,
  XCircle,
  Info,
} from "@/components/layout/Icons";
import { formatNumber, formatCurrency } from "@/frontend/lib/utils";
import { getModelById } from "@/lib/ai/models";
import type { Dataset, Experiment, Prompt } from "@/types";
import { useLiveRun } from "@/hooks/useLiveRun";
import { RunLiveCard } from "@/components/runs/RunLiveCard";
import { DatasetFormatIcon } from "@/components/datasets/DatasetFormatIcon";
import { computeDatasetHealth, estimateRunCost, suggestExperimentName } from "@/lib/experiments/smart";
import { labelForDatasetFormat } from "@/lib/datasets/formats";

const steps = [
  { id: "dataset", label: "Dataset", icon: Database, desc: "Select dataset" },
  { id: "models", label: "Models", icon: Cpu, desc: "Choose models" },
  { id: "prompt", label: "Prompt", icon: MessageSquare, desc: "Configure prompt" },
  { id: "metrics", label: "Metrics", icon: BarChart2, desc: "Select metrics" },
  { id: "review", label: "Review", icon: Eye, desc: "Review config" },
  { id: "run", label: "Run", icon: Play, desc: "Launch" },
];

const metricsList = [
  { id: "accuracy", label: "Accuracy", icon: Target, desc: "Correctness" },
  { id: "faithfulness", label: "Faithfulness", icon: Shield, desc: "Context adherence" },
  { id: "relevance", label: "Relevance", icon: ArrowUpRight, desc: "Question relevance" },
  { id: "hallucination", label: "Hallucination", icon: AlertCircle, desc: "Fabrication detection" },
  { id: "completeness", label: "Completeness", icon: ListChecks, desc: "Answer coverage" },
  { id: "toxicity", label: "Toxicity", icon: ShieldAlert, desc: "Harmful language" },
  { id: "bias", label: "Bias", icon: Scale, desc: "Biased framing" },
  { id: "latency", label: "Latency", icon: Clock, desc: "Response time" },
  { id: "cost", label: "Cost", icon: DollarSign, desc: "Token cost" },
  { id: "safety", label: "Safety", icon: Sparkles, desc: "Safety" },
];

export default function NewExperimentPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [current, setCurrent] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [registryModels, setRegistryModels] = useState<ModelConfig[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [data, setData] = useState({
    datasetId: "",
    modelIds: ["dots-3-note-preview"] as string[],
    systemPrompt: "You are a helpful AI assistant. Answer concisely and accurately.",
    userPrompt: "Answer the following question based on the context:\n\nContext: {{context}}\nQuestion: {{question}}",
    temperature: 0.7,
    maxTokens: 512,
    judgeModel: "free-router",
    dimensions: metricsList.map((m) => m.id),
    name: "",
    description: "",
    runImmediately: true,
    providerKind: "auto",
  });

  const [similarExperiments, setSimilarExperiments] = useState<Experiment[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.status === "success" && Array.isArray(j.prompts)) setSavedPrompts(j.prompts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSavedPrompt = (id: string) => {
    setSelectedPromptId(id);
    if (!id) return;
    const p = savedPrompts.find((x) => x.id === id);
    if (!p) return;
    setData((prev) => ({
      ...prev,
      systemPrompt: p.systemPrompt ?? prev.systemPrompt,
      userPrompt: p.userPrompt,
    }));
  };

  const canNext = () => {
    if (current === 0) return !!data.datasetId;
    if (current === 1) return data.modelIds.length > 0;
    if (current === 2) return data.systemPrompt.trim().length > 10 && data.userPrompt.includes("{{question}}");
    if (current === 3) return data.dimensions.length > 0;
    if (current === 4) return !!data.name.trim();
    return true;
  };

  const next = () => {
    if (!canNext()) {
      toastError("Complete this step", "Please fill required fields before continuing.");
      return;
    }
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  };
  const back = () => setCurrent((c) => Math.max(c - 1, 0));
  const [inRun, setInRun] = useState(false);
  const liveRun = useLiveRun();
  const running = liveRun.state.phase === "connecting" || liveRun.state.phase === "running";

  // Load real datasets with TestCase[] from repository API â€” single source
  useEffect(() => {
    let cancelled = false;
    // Dataset detail pages link here with ?dataset=<id> to pre-select the dataset.
    const preselect = new URLSearchParams(window.location.search).get("dataset");
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.status === "success" && Array.isArray(j.datasets)) {
          setDatasets(j.datasets);
          if (preselect) {
            const match = j.datasets.find((d: { id: string }) => d.id === preselect);
            if (match) setData((prev) => ({ ...prev, datasetId: match.id }));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Single source of truth for models â€” GET /api/models â†’ backend/lib/ai/models.ts
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && Array.isArray(j.models)) setRegistryModels(j.models);
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, []);

  // Past experiments â€” used to warn when the same dataset+models+judge already exists.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/experiments")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.status === "success" && Array.isArray(j.experiments)) {
          setSimilarExperiments(j.experiments);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const launch = async () => {
    if (!data.name.trim()) { toastError("Name required", "Give your experiment a name."); setCurrent(4); return; }
    if (data.modelIds.length === 0 || !data.datasetId) { toastError("Incomplete", "Select dataset and at least one model."); return; }
    if (running) return;
    const dataset = datasets.find((d) => d.id === data.datasetId);
    setInRun(true);
    setCurrent(5);
    liveRun.reset();
    try {
      // Step 1: Create real Experiment record
      const createRes = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description?.trim() || "",
          datasetId: data.datasetId,
          modelIds: data.modelIds,
          systemPrompt: data.systemPrompt,
          promptTemplate: data.userPrompt,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          judgeModelId: data.judgeModel,
        }),
      });
      const createJson = await createRes.json();
      if (createJson.status !== "success" || !createJson.experiment) throw new Error(createJson.error || "Failed to create experiment");
      const experimentId: string = createJson.experiment.id;

      // Step 2: Execute real evaluation pipeline over SSE â€” live progress.
      // Production runs evaluate ALL test cases (no sampling).
      await liveRun.start({
        experimentId,
        datasetId: data.datasetId,
        modelIds: data.modelIds,
        providerKind: data.providerKind,
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        judgeModelId: data.judgeModel,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      if (msg.toLowerCase().includes("insufficient credits") || msg.includes("402")) {
        toastError("OpenRouter: insufficient credits", "Key valid but no credits â€” using mock. Add credits at openrouter.ai");
      } else if (msg.includes("NO_TEST_CASES")) {
        toastError("No test cases", "Dataset has no test cases. Add cases in Datasets.");
      } else {
        toastError("Evaluation failed", msg.slice(0, 140));
      }
      setInRun(false);
      liveRun.reset();
    }
  };

  // React to live run completion â€” navigate only when something was executed
  useEffect(() => {
    if (liveRun.state.phase !== "done" || !liveRun.state.final) return;
    const f = liveRun.state.final;
    if (f.failed > 0 && f.successful > 0) {
      success("Experiment partial", `${f.successful}/${f.total} succeeded â€” ${f.failed} failed`);
    } else if (f.failed === 0) {
      success("Experiment completed", `${f.successful}/${f.total} succeeded (${f.aggregated?.[0]?.modelId ?? "â€”"})`);
    } else {
      toastError("Run failed", "No test case could be executed successfully.");
      return;
    }
    router.push(`/experiments/${f.experimentId}`);
  }, [liveRun.state.phase, liveRun.state.final, router, success, toastError]);

  const selectedDataset = datasets.find((d) => d.id === data.datasetId);
  const totalCases = selectedDataset?.testCases ?? 0;
  const health = useMemo(() => computeDatasetHealth(selectedDataset ?? { cases: [] }), [selectedDataset]);

  const est = useMemo(
    () =>
      estimateRunCost({
        cases: selectedDataset?.cases?.length ?? totalCases,
        modelIds: data.modelIds,
        models: registryModels,
        judgeModelId: data.judgeModel,
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        maxTokens: data.maxTokens,
      }),
    [selectedDataset, totalCases, data.modelIds, data.judgeModel, data.systemPrompt, data.userPrompt, data.maxTokens, registryModels]
  );

  const duplicate = useMemo(() => {
    if (!data.datasetId || data.modelIds.length === 0) return null;
    const key = (ids: string[]) => [...ids].sort().join("|");
    const target = key(data.modelIds);
    return (
      similarExperiments.find(
        (e) => e.datasetId === data.datasetId && key(e.models) === target && (e as Experiment & { judgeModelId?: string }).judgeModelId === data.judgeModel
      ) ?? null
    );
  }, [similarExperiments, data.datasetId, data.modelIds, data.judgeModel]);

  const suggestedName = useMemo(
    () => (selectedDataset ? suggestExperimentName(selectedDataset.name, data.modelIds, registryModels) : ""),
    [selectedDataset, data.modelIds, registryModels]
  );

  return (
    <DashboardLayout>
      <PageContainer title="Create Experiment" description="6-step wizard â€” dataset, models, prompt, metrics, review, run. Validation at each step.">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const active = i === current;
              const done = i < current;
              return (
                <div key={s.id} className="flex items-center gap-2 shrink-0">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center border text-xs font-medium transition ${done ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" : active ? "bg-[#C8A96E] border-[#C8A96E] text-[#0F0F0F]" : "bg-[#1A1A1E] border-[#2A2A28] text-stone-500"}`}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-xs font-medium leading-none ${active ? "text-[#F5F1EB]" : done ? "text-emerald-400" : "text-stone-500"}`}>{s.label}</p>
                    <p className="text-[11px] text-stone-500">{s.desc}</p>
                  </div>
                  {i < steps.length - 1 && <div className={`hidden sm:block w-8 h-px mx-2 ${done ? "bg-emerald-500/30" : "bg-[#2A2A28]"}`} />}
                </div>
              );
            })}
          </div>

          {inRun && liveRun.state.phase !== "idle" && (
            <div className="mb-6">
              <RunLiveCard
                state={liveRun.state}
                onRetry={launch}
                onDismiss={() => {
                  liveRun.reset();
                  setInRun(false);
                }}
              />
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="h-1 bg-[#0F0F0F]"><motion.div className="h-full bg-[#C8A96E]" animate={{ width: `${((current + 1) / steps.length) * 100}%` }} transition={{ duration: 0.4 }} /></div>
            <AnimatePresence mode="wait">
              <motion.div key={steps[current].id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="p-6 lg:p-8">
                {current === 0 && (
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl text-[#F5F1EB]">Select Dataset</h3>
                    <p className="text-sm text-stone-400">Choose the dataset to evaluate against. Datasets with missing answers are flagged below.</p>
                    <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
                      {datasetsLoading ? (
                        <div className="p-8 text-center text-sm text-stone-500">Loading datasetsâ€¦</div>
                      ) : datasets.length === 0 ? (
                        <div className="p-8 text-center text-sm text-stone-500">No datasets available. Create one in Datasets.</div>
                      ) : (
                        datasets.map((d) => {
                          const h = computeDatasetHealth(d ?? { cases: [] });
                          const sourceTag = (d.tags ?? []).find((t) => t.startsWith("source:"));
                          const sourceFormat = sourceTag?.replace("source:", "") ?? d.format;
                          const unusable = h.total === 0 || h.emptyInputs > 0;
                          const selected = data.datasetId === d.id;
                          return (
                            <label
                              key={d.id}
                              className={`flex items-start gap-3 p-4 rounded-xl border transition ${unusable ? "opacity-60" : selected ? "bg-[#C8A96E]/10 border-[#C8A96E]/30" : "bg-[#0F0F0F] border-[#2A2A28] hover:border-[#3A3A38] cursor-pointer"}`}
                            >
                              <input type="radio" name="dataset" checked={selected} disabled={unusable} onChange={() => setData({ ...data, datasetId: d.id })} className="h-4 w-4 accent-[#C8A96E] mt-1" />
                              <div className="h-10 w-10 shrink-0 rounded-xl bg-[#0F0F0F] border border-[#2A2A28] flex items-center justify-center text-[#C8A96E]">
                                <DatasetFormatIcon format={d.format} className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-sm truncate">{d.name}</p>
                                  {sourceFormat && <Badge variant="neutral" size="sm">{labelForDatasetFormat(sourceFormat)}</Badge>}
                                  <Badge variant={d.status === "ready" ? "success" : "warning"} size="sm">{d.status}</Badge>
                                </div>
                                <p className="text-xs text-stone-500">{formatNumber(h.total)} cases â€¢ {d.size}</p>
                                {h.total > 0 && h.unlabeled > 0 && (
                                  <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {h.unlabeled}/{h.total} have no expected answer â€” accuracy for them will be skewed</p>
                                )}
                                {h.total === 0 && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> No test cases â€” add cases in Datasets first</p>}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {selectedDataset && health.total > 0 && (
                      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${health.accuracyReliable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                        {health.accuracyReliable ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                        <span>
                          {health.accuracyReliable
                            ? `Ready â€” all ${formatNumber(health.total)} cases have expected answers.`
                            : `${formatNumber(health.total - health.labeled)} of ${formatNumber(health.total)} cases lack an expected answer â€” accuracy scores will be partially unreliable.`}
                        </span>
                      </div>
                    )}
                    {!data.datasetId && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Select a dataset to continue.</p>}
                  </div>
                )}
                {current === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl text-[#F5F1EB]">Select Models</h3>
                    <p className="text-sm text-stone-400">Toggle models. Only active, enabled models are shown â€” disabled, deprecated, or beta models are excluded.</p>
                    <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
                      {modelsLoading ? (
                        <div className="p-8 text-center text-sm text-stone-500">Loading modelsâ€¦</div>
                      ) : (
                        registryModels.filter((m) => m.status === "active" && (m as ModelConfig & { enabled?: boolean }).enabled !== false).map((m) => (
                          <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${data.modelIds.includes(m.slug) || data.modelIds.includes(m.id) ? "bg-[#C8A96E]/10 border-[#C8A96E]/30" : "bg-[#0F0F0F] border-[#2A2A28]"}`}>
                            <input
                              type="checkbox"
                              checked={data.modelIds.includes(m.slug) || data.modelIds.includes(m.id)}
                              onChange={(e) => {
                                const id = m.slug;
                                setData({ ...data, modelIds: e.target.checked ? [...data.modelIds, id] : data.modelIds.filter((x) => x !== id && x !== m.id) });
                              }}
                              className="h-4 w-4 accent-[#C8A96E]"
                            />
                            <div className="h-9 w-9 rounded-lg bg-[#C8A96E] flex items-center justify-center text-xs font-bold text-[#0F0F0F]">{m.displayName[0]}</div>
                            <div className="flex-1"><p className="font-medium text-sm">{m.displayName}</p><p className="text-xs text-stone-500">{m.provider} â€¢ {m.contextLength.toLocaleString()} ctx â€¢ ${m.pricing.prompt}/${m.pricing.completion}/1M</p></div>
                          </label>
                        ))
                      )}
                    </div>
                    {data.modelIds.length === 0 && <p className="text-xs text-amber-400">Select at least one model.</p>}
                  </div>
                )}
                {current === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl text-[#F5F1EB]">Configure Prompt</h3>
                    <p className="text-sm text-stone-400">System + user template. Must include {"{{question}}"}.</p>
                    {savedPrompts.length > 0 && (
                      <div>
                        <label className="label">Load Saved Prompt</label>
                        <select value={selectedPromptId} onChange={(e) => loadSavedPrompt(e.target.value)} className="input">
                          <option value="">â€” Choose a saved prompt â€”</option>
                          {savedPrompts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-stone-500 mt-1">Selecting a saved prompt fills the fields below.</p>
                      </div>
                    )}
                    <div>
                      <label className="label">System Prompt</label>
                      <textarea value={data.systemPrompt} onChange={(e) => setData({ ...data, systemPrompt: e.target.value })} rows={3} className="input min-h-[84px] resize-none" placeholder="You are a helpful assistant..." />
                      <p className="text-xs text-stone-500 mt-1">{data.systemPrompt.length} chars â€¢ min 10</p>
                    </div>
                    <div>
                      <label className="label">User Prompt Template</label>
                      <textarea value={data.userPrompt} onChange={(e) => setData({ ...data, userPrompt: e.target.value })} rows={4} className="input font-mono text-xs min-h-[110px] resize-none" />
                      {!data.userPrompt.includes("{{question}}") && <p className="text-xs text-red-400 mt-1">Must include {"{{question}}"} placeholder.</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="label">Temperature: {data.temperature}</label><input type="range" min={0} max={1} step={0.1} value={data.temperature} onChange={(e) => setData({ ...data, temperature: parseFloat(e.target.value) })} className="w-full accent-[#C8A96E]" /></div>
                      <div><label className="label">Max Tokens</label><input type="number" value={data.maxTokens} onChange={(e) => setData({ ...data, maxTokens: parseInt(e.target.value) || 0 })} className="input" /></div>
                    </div>
                  </div>
                )}
                {current === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl text-[#F5F1EB]">Select Metrics</h3>
                    <p className="text-sm text-stone-400">Choose evaluation dimensions. At least one required.</p>
                    <div className="flex flex-wrap gap-2">
                      {metricsList.map((m) => (
                        <label key={m.id} className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-2 cursor-pointer ${data.dimensions.includes(m.id) ? "bg-[#C8A96E] border-[#C8A96E] text-[#0F0F0F] font-medium" : "bg-[#0F0F0F] border-[#2A2A28] text-stone-400 hover:border-[#3A3A38]"}`}>
                          <input type="checkbox" checked={data.dimensions.includes(m.id)} onChange={(e) => setData({ ...data, dimensions: e.target.checked ? [...data.dimensions, m.id] : data.dimensions.filter((x) => x !== m.id) })} className="h-3 w-3 accent-[#C8A96E] hidden" />
                          <m.icon className="h-4 w-4" /> {m.label}
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="label">Judge Model</label>
                      <select value={data.judgeModel} onChange={(e) => setData({ ...data, judgeModel: e.target.value })} className="input">
                        <option value="free-router">Free Router ($0)</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </select>
                    </div>
                  </div>
                )}
                {current === 4 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-serif text-xl text-[#F5F1EB] mb-1">Review</h3>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Input label="Experiment Name *" placeholder="e.g., Q4 RittikEvalOpsAI Benchmark" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
                        </div>
                        {suggestedName && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setData({ ...data, name: suggestedName })}
                            leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                            className="mb-0.5"
                            title={`Set name to "${suggestedName}"`}
                          >
                            Suggest name
                          </Button>
                        )}
                      </div>
                    </div>
                    <Input label="Description" placeholder="Purpose of this run" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />

                    {duplicate && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <p className="font-medium">This exact run already exists</p>
                          <p className="text-xs text-amber-200/70 mt-0.5">
                            <Link href={`/experiments/${encodeURIComponent(duplicate.id)}`} className="underline hover:text-amber-100">
                              {duplicate.name}
                            </Link>{" "}
                            uses the same dataset, models, and judge. Running again will add another entry to its Run History.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]"><p className="text-stone-500 text-xs">Dataset</p><p className="font-medium">{selectedDataset?.name || "â€”"} â€¢ {formatNumber(totalCases)} cases</p></div>
                      <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]"><p className="text-stone-500 text-xs">Eval count</p><p className="font-medium">{formatNumber(est.evalCount)} ({data.modelIds.length} Ã— dataset)</p></div>
                      <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]"><p className="text-stone-500 text-xs">Est. total cost</p><p className="font-medium text-[#C8A96E]">{formatCurrency(est.totalCost)}</p></div>
                    </div>

                    <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-4">
                      <p className="text-xs text-stone-500 mb-2">Cost breakdown</p>
                      {est.perModel.map((pm) => (
                        <div key={pm.modelId} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="text-stone-300">{pm.displayName}</span>
                          <span className="font-mono tabular-nums text-stone-400">{formatCurrency(pm.cost)}{pm.free ? <span className="text-emerald-400 ml-1">free</span> : null}</span>
                        </div>
                      ))}
                      {est.judge && (
                        <div className="flex items-center justify-between py-1.5 text-sm border-t border-[#2A2A28] mt-1">
                          <span className="text-stone-300">Judge â€” {est.judge.displayName}</span>
                          <span className="font-mono tabular-nums text-stone-400">{formatCurrency(est.judge.cost)}{est.judge.free ? <span className="text-emerald-400 ml-1">free</span> : null}</span>
                        </div>
                      )}
                      <p className="text-xs text-stone-500 mt-2">~{est.minutes.toFixed(1)} min estimated. Judge scoring is included in the estimate.</p>
                    </div>

                    <div>
                      <p className="text-xs text-stone-500 mb-1">System prompt</p>
                      <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28] text-xs text-stone-400 line-clamp-2">{data.systemPrompt}</div>
                    </div>
                    {!data.name.trim() && <p className="text-xs text-red-400">Name is required.</p>}
                  </div>
                )}
                {current === 5 && (
                  <div className="space-y-5 py-2">
                    <div className="text-center space-y-2">
                      <div className="h-14 w-14 mx-auto rounded-2xl bg-[#C8A96E] flex items-center justify-center"><Play className="h-6 w-6 text-[#0F0F0F] ml-0.5" /></div>
                      <h3 className="font-serif text-2xl">Ready to run</h3>
                      <p className="text-sm text-stone-400">
                        {formatNumber(est.evalCount)} evaluations Â· ~{est.minutes.toFixed(1)} min Â· {formatCurrency(est.totalCost)}
                      </p>
                      <p className="text-xs text-stone-500">Runs against the configured AI provider (OpenRouter when a key is set). Progress is live.</p>
                    </div>

                    <div className="rounded-xl border border-[#2A2A28] bg-[#0F0F0F] p-4 space-y-2">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Provider mode</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: "auto", label: "Auto (real)", desc: "Use provider when available" },
                          { value: "openrouter", label: "Real", desc: "Force live OpenRouter calls" },
                          { value: "mock", label: "Mock (deterministic)", desc: "Offline simulated answers" },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setData((d) => ({ ...d, providerKind: opt.value }))}
                            className={`rounded-lg border px-3 py-2 text-left transition ${
                              data.providerKind === opt.value
                                ? "border-[#C8A96E] bg-[#C8A96E]/10"
                                : "border-[#2A2A28] hover:border-[#3a3a36]"
                            }`}
                          >
                            <span className="block text-xs font-medium text-stone-200">{opt.label}</span>
                            <span className="block text-[11px] text-stone-500">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {data.providerKind === "mock"
                          ? "Executes locally with deterministic simulated answers and metrics â€” no network, no credits, always completes."
                          : "In Auto mode, real OpenRouter calls are used only when a key is configured; otherwise it silently falls back to mock."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#2A2A28] bg-[#0F0F0F] p-4 space-y-3">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Run readiness</p>
                      {health.total === 0 ? (
                        <div className="flex items-start gap-2 text-sm text-red-300"><XCircle className="h-4 w-4 shrink-0 mt-0.5" /> The dataset has no test cases â€” add cases in Datasets before running.</div>
                      ) : health.usable && health.accuracyReliable ? (
                        <div className="flex items-start gap-2 text-sm text-emerald-300"><CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> All {formatNumber(health.total)} cases are labeled with expected answers.</div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm text-amber-300"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {formatNumber(health.unlabeled)} of {formatNumber(health.total)} cases have no expected answer â€” accuracy will be partially unreliable.</div>
                      )}
                      {data.modelIds.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-emerald-300">
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{data.modelIds.length} model{data.modelIds.length === 1 ? "" : "s"} configured: {data.modelIds.map((id) => getModelById(id)?.displayName || id).join(", ")}</span>
                        </div>
                      )}
                      {est.judge && (
                        <div className="flex items-start gap-2 text-sm text-stone-300">
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-300" />
                          <span>Judge: {est.judge.displayName}{est.judge.free ? " (free)" : ` Â· adds ${formatCurrency(est.judge.cost)}`}</span>
                        </div>
                      )}
                      {duplicate && (
                        <div className="flex items-start gap-2 text-sm text-amber-300">
                          <Info className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>
                            An identical experiment exists â€”{" "}
                            <Link href={`/experiments/${encodeURIComponent(duplicate.id)}`} className="underline hover:text-amber-100">{duplicate.name}</Link>.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="px-6 lg:px-8 py-4 border-t border-[#2A2A28] flex items-center justify-between">
              <span className="text-sm text-stone-500">Step {current + 1} / {steps.length}</span>
              <div className="flex gap-2">
                {current > 0 && <Button variant="ghost" onClick={back} leftIcon={<ChevronLeft className="h-4 w-4" />} disabled={running}>Back</Button>}
                {current < steps.length - 1 ? <Button variant="primary" onClick={next} rightIcon={<ChevronRight className="h-4 w-4" />} disabled={!canNext() || running}>Next</Button> : <Button variant="primary" onClick={launch} isLoading={running} leftIcon={<Play className="h-4 w-4" />} disabled={running}>Run Experiment</Button>}
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}

