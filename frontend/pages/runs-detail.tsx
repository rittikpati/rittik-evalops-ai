"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { MetricCard } from "@/components/charts/ChartComponents";
import { getModelById } from "@/lib/ai/models";
import type { EvaluationRun } from "@/lib/evaluations/types";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
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
  ChevronLeft,
  ExternalLink,
} from "@/components/layout/Icons";
import { formatNumber, formatCurrency, formatPercent, formatRelativeTime, formatDuration } from "@/frontend/lib/utils";

type ResultRow = EvaluationRun["results"][number];

const badgeVariant = (status: EvaluationRun["status"]): "success" | "info" | "warning" | "danger" =>
  status === "completed" ? "success" : status === "running" ? "info" : status === "partial" ? "warning" : "danger";

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch(`/api/runs/${encodeURIComponent(runId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && j.run) {
          setRun(j.run as EvaluationRun);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [runId]);

  const results = useMemo(() => run?.results ?? [], [run]);
  const aggregatedRows = useMemo(() => {
    const map = new Map<string, ResultRow[]>();
    results.forEach((r) => {
      const list = map.get(r.model) || [];
      list.push(r);
      map.set(r.model, list);
    });
    return Array.from(map.entries())
      .map(([model, list]) => {
        const ok = list.filter((r) => r.status === "success");
        const n = ok.length;
        const avg = (key: keyof NonNullable<ResultRow["scores"]>) => {
          const vals = ok.map((r) => r.scores?.[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
          return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
        };
        const name = getModelById(model)?.displayName || model;
        return {
          modelId: model,
          modelName: name,
          provider: getModelById(model)?.provider || "â€”",
          count: list.length,
          successful: ok.length,
          accuracy: avg("accuracy"),
          faithfulness: avg("faithfulness"),
          relevance: avg("relevance"),
          hallucination: avg("hallucination"),
          completeness: avg("completeness"),
          toxicity: avg("toxicity"),
          bias: avg("bias"),
          safety: avg("safety"),
          latency: n ? ok.reduce((s, r) => s + r.latency, 0) / n : null,
          cost: list.reduce((s, r) => s + (r.estimatedCost || 0), 0),
        };
      })
      .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));
  }, [results]);

  const filtered = filter === "all" ? results : results.filter((r) => r.model === filter);
  const modelOptions = useMemo(() => Array.from(new Set(results.map((r) => r.model))), [results]);

  const ok = results.filter((r) => r.status === "success");
  const errCount = results.length - ok.length;
  const scoredOk = ok.filter((r) => typeof r.scores?.accuracy === "number" && Number.isFinite(r.scores.accuracy));
  const avgAccuracy = scoredOk.length ? scoredOk.reduce((s, r) => s + (r.scores!.accuracy as number), 0) / scoredOk.length : undefined;
  const avgLatency = ok.length ? ok.reduce((s, r) => s + r.latency, 0) / ok.length : undefined;
  const totalCost = results.reduce((s, r) => s + (r.estimatedCost || 0), 0);
  const totalTokens = results.reduce((s, r) => s + r.totalTokens, 0);
  const successRate = results.length ? ok.length / results.length : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer title="Run" description="Loadingâ€¦">
          <Card className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading runâ€¦</p>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (notFound || !run) {
    return (
      <DashboardLayout>
        <PageContainer title="Run Not Found" description="No persisted run matches this id.">
          <Card className="p-12 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />
            <p className="text-foreground font-medium">Run <span className="font-mono text-accent-400">{runId}</span> was not found.</p>
            <div className="flex justify-center gap-2">
              <Link href="/evaluations"><Button variant="primary" leftIcon={<ChevronLeft className="h-4 w-4" />}>Back to Evaluations</Button></Link>
              <Link href="/experiments"><Button variant="ghost">Experiments</Button></Link>
            </div>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const aggregateColumns: Column<(typeof aggregatedRows)[number]>[] = [
    { key: "modelName", header: "Model", render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
          {row.modelName.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-foreground">{row.modelName}</p>
          <p className="text-xs text-stone-400">{row.provider} â€¢ {row.modelId}</p>
        </div>
      </div>
    )},
    { key: "count", header: "Results", render: (_, row) => <span className="font-mono text-stone-300">{row.successful}<span className="text-stone-600">/{row.count}</span></span> },
    { key: "accuracy", header: "Accuracy", render: (_, row) => <span className="font-mono tabular-nums font-semibold">{row.accuracy !== null && row.accuracy !== undefined ? formatPercent(row.accuracy) : "â€”"}</span> },
    { key: "faithfulness", header: "Faithfulness", render: (_, row) => <span className="font-mono tabular-nums">{row.faithfulness !== null && row.faithfulness !== undefined ? formatPercent(row.faithfulness) : "â€”"}</span> },
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      if (row.hallucination === null || row.hallucination === undefined) return <span className="text-stone-500">â€”</span>;
      return <Badge variant={row.hallucination >= 0.85 ? "success" : row.hallucination >= 0.7 ? "warning" : "danger"} size="sm">{formatPercent(row.hallucination)}</Badge>;
    }},
    { key: "completeness", header: "Completeness", render: (_, row) => <span className="font-mono tabular-nums">{row.completeness !== null && row.completeness !== undefined ? formatPercent(row.completeness) : "â€”"}</span> },
    { key: "toxicity", header: "Toxicity", render: (_, row) => <span className="font-mono tabular-nums">{row.toxicity !== null && row.toxicity !== undefined ? formatPercent(row.toxicity) : "â€”"}</span> },
    { key: "bias", header: "Bias", render: (_, row) => <span className="font-mono tabular-nums">{row.bias !== null && row.bias !== undefined ? formatPercent(row.bias) : "â€”"}</span> },
    { key: "safety", header: "Safety", render: (_, row) => <span className="font-mono tabular-nums">{row.safety !== null && row.safety !== undefined ? formatPercent(row.safety) : "â€”"}</span> },
    { key: "latency", header: "Latency", render: (_, row) => <span className="font-mono text-stone-300">{row.latency !== null && row.latency !== undefined ? `${(row.latency / 1000).toFixed(2)}s` : "â€”"}</span> },
    { key: "cost", header: "Cost", render: (_, row) => <span className="font-mono text-stone-300">{formatCurrency(row.cost)}</span> },
  ];

  const resultColumns: Column<ResultRow>[] = [
    { key: "testCaseId", header: "Case", width: "120px", render: (_, row) => <span className="font-mono text-xs text-stone-500">{row.testCaseId}</span> },
    { key: "input", header: "Question", width: "300px", render: (_, row) => (
      <div className="max-w-xs"><p className="font-medium text-foreground line-clamp-2">{row.input}</p></div>
    )},
    { key: "model", header: "Model", width: "130px", render: (_, row) => <span className="text-stone-300">{getModelById(row.model)?.displayName || row.model}</span> },
    { key: "status", header: "Status", render: (_, row) => (
      <Badge variant={row.status === "success" ? "success" : "danger"} size="sm">{row.status === "success" ? "OK" : "Error"}</Badge>
    )},
    { key: "source", header: "Source", width: "90px", render: () => (
      <Badge variant={run.mode === "openrouter" ? "brand" : "neutral"} size="sm">{run.mode === "openrouter" ? "OpenRouter" : "Mock"}</Badge>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => (
      <span className="font-mono tabular-nums font-semibold">{row.scores?.accuracy !== null && row.scores?.accuracy !== undefined ? formatPercent(row.scores.accuracy) : "â€”"}</span>
    )},
    { key: "completeness", header: "Completeness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.completeness !== null && row.scores?.completeness !== undefined ? formatPercent(row.scores.completeness) : "â€”"}</span>
    )},
    { key: "toxicity", header: "Toxicity", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.toxicity !== null && row.scores?.toxicity !== undefined ? formatPercent(row.scores.toxicity) : "â€”"}</span>
    )},
    { key: "bias", header: "Bias", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.scores?.bias !== null && row.scores?.bias !== undefined ? formatPercent(row.scores.bias) : "â€”"}</span>
    )},
    { key: "latency", header: "Latency", render: (_, row) => (
      <span className="font-mono text-stone-300">{row.status === "success" ? `${(row.latency / 1000).toFixed(2)}s` : "â€”"}</span>
    )},
    { key: "tokens", header: "Tokens", render: (_, row) => <span className="font-mono text-stone-400">{formatNumber(row.totalTokens)}</span> },
    { key: "cost", header: "Cost", render: (_, row) => (
      <span className="font-mono text-stone-300">{row.estimatedCost != null ? formatCurrency(row.estimatedCost) : "â€”"}</span>
    )},
    { key: "actions", header: "", render: (_, row) => (
      <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" onClick={() => setSelectedResult(row)} aria-label="View details">
        <Eye className="h-4 w-4" />
      </button>
    )},
  ];

  const metricCards = [
    { label: "Success Rate", value: formatPercent(successRate), icon: <Target className="h-5 w-5" /> },
    { label: "Avg Accuracy", value: avgAccuracy !== undefined ? formatPercent(avgAccuracy) : "â€”", icon: <Shield className="h-5 w-5" /> },
    { label: "Avg Latency", value: avgLatency !== undefined && avgLatency !== null ? `${(avgLatency / 1000).toFixed(2)}s` : "â€”", icon: <Clock className="h-5 w-5" /> },
    { label: "Total Cost", value: formatCurrency(totalCost), icon: <DollarSign className="h-5 w-5" /> },
    { label: "Total Tokens", value: formatNumber(totalTokens), icon: <BarChart2 className="h-5 w-5" /> },
    { label: "Failed", value: formatNumber(errCount), icon: <AlertCircle className="h-5 w-5" /> },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title={`Run ${run.id.slice(0, 16)}`}
        description={`Run of "${run.datasetName}" â€¢ ${run.modelNames.length} model${run.modelNames.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/experiments/${run.experimentId}`}>
              <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Experiment</Button>
            </Link>
            <Link href="/evaluations">
              <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}>All Evaluations</Button>
            </Link>
          </div>
        }
      >
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={badgeVariant(run.status)} dot size="lg">
              <span className="capitalize">{run.status}</span>
            </Badge>
            <Badge variant={run.mode === "openrouter" ? "brand" : "neutral"} size="sm">
              <Cpu className="h-3 w-3" /> {run.mode === "openrouter" ? "OpenRouter (real)" : "Mock provider"}
            </Badge>
            <Badge variant="info" size="sm"><Database className="h-3 w-3" /> {run.datasetName}</Badge>
            <Badge variant="neutral" size="sm"><Cpu className="h-3 w-3" /> {run.modelNames.join(", ")}</Badge>
            <Badge variant="neutral" size="sm"><Clock className="h-3 w-3" /> Started {formatRelativeTime(run.startedAt)}</Badge>
            {run.completedAt && (
              <Badge variant="neutral" size="sm"><CheckCircle className="h-3 w-3" /> {formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())}</Badge>
            )}
            <Badge variant="neutral" size="sm"><BarChart2 className="h-3 w-3" /> {ok.length}/{results.length} succeeded</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {metricCards.map((metric, index) => (
            <motion.div key={metric.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.03 }}>
              <MetricCard {...metric} />
            </motion.div>
          ))}
        </div>

        {run.errors.length > 0 && (
          <Card className="mb-6 p-4 border-danger-500/30">
            <p className="flex items-center gap-2 font-medium text-danger-400 mb-2">
              <AlertTriangle className="h-4 w-4" /> {run.errors.length} execution error{run.errors.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-1">
              {run.errors.map((e, i) => (
                <p key={i} className="font-mono text-xs text-stone-400">
                  <span className="text-stone-500">[{e.modelId}]</span> {e.testCaseId}: {e.code ? <span className="uppercase text-danger-400/80">[{e.code}]</span> : null} {e.message}
                </p>
              ))}
            </div>
          </Card>
        )}

        <Section title="Per-Model Aggregation" description="Derived from this run's successful case results">
          {aggregatedRows.length > 0 ? (
            <Table columns={aggregateColumns} data={aggregatedRows} keyExtractor={(row) => row.modelId} hoverable />
          ) : (
            <Card className="p-10 text-center text-sm text-stone-500">No successful evaluations in this run.</Card>
          )}
        </Section>

        <Section title="Case Results" description={`${results.length} evaluations â€¢ ${ok.length} succeeded â€¢ ${errCount} failed`}>
          <div className="flex items-center gap-3 mb-4">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
              <option value="all">All Models</option>
              {modelOptions.map((id) => <option key={id} value={id}>{getModelById(id)?.displayName || id}</option>)}
            </select>
            <span className="text-xs text-stone-500">Click the eye icon to expand a case.</span>
          </div>
          <Table columns={resultColumns} data={filtered} keyExtractor={(row) => `${row.model}-${row.testCaseId}`} hoverable emptyMessage="No results in this run." />
        </Section>

        <Section title="Config" description="How this run was executed">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Provider Mode</p><p className="font-mono text-sm">{run.mode === "openrouter" ? "OpenRouter" : "Mock"}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Judge</p><p className="font-mono text-sm truncate">{run.judgeModelId}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Temperature</p><p className="font-mono text-sm">{run.temperature ?? "â€”"}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Max Tokens</p><p className="font-mono text-sm">{run.maxTokens ?? "â€”"}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Run Created</p><p className="font-mono text-sm">{formatRelativeTime(run.createdAt)}</p></div>
          </div>
          <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3 mt-3">
            <p className="text-xs text-stone-500 mb-1">Prompt Template</p>
            <p className="text-sm text-stone-300 font-mono whitespace-pre-wrap">{run.promptTemplate}</p>
          </div>
          {run.systemPrompt && (
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3 mt-3">
              <p className="text-xs text-stone-500 mb-1">System Prompt</p>
              <p className="text-sm text-stone-300 whitespace-pre-wrap">{run.systemPrompt}</p>
            </div>
          )}
        </Section>

        {selectedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedResult(null)}>
            <motion.div
              className="w-full max-w-3xl max-h-[90vh] overflow-auto glass-strong border border-[#2A2A28] rounded-2xl shadow-glass-strong"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#2A2A28] flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Case Result</h2>
                <button onClick={() => setSelectedResult(null)} className="p-2 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-stone-400">Model</p>
                    <p className="font-medium text-foreground">{getModelById(selectedResult.model)?.displayName || selectedResult.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Test Case</p>
                    <p className="font-mono text-sm text-stone-300">{selectedResult.testCaseId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Status</p>
                    <Badge variant={selectedResult.status === "success" ? "success" : "danger"} size="sm">{selectedResult.status}</Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Question</p>
                    <div className="p-4 rounded-lg bg-white/[0.04] border border-[#2A2A28]"><p className="text-foreground">{selectedResult.input}</p></div>
                  </div>
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Expected Answer</p>
                    <div className="p-4 rounded-lg bg-white/[0.04] border border-[#2A2A28]"><p className="text-foreground">{selectedResult.expectedOutput}</p></div>
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
                      <MetricCard label="Latency" value={`${(selectedResult.latency / 1000).toFixed(2)}s`} icon={<Clock className="h-5 w-5" />} />
                      <MetricCard label="Cost" value={formatCurrency(selectedResult.estimatedCost || 0)} icon={<DollarSign className="h-5 w-5" />} />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}