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
  Shield,
  AlertCircle,
  BarChart2,
  Target,
  Eye,
  ChevronLeft,
  ExternalLink,
} from "@/components/layout/Icons";
import { formatNumber, formatCurrency, formatPercent, formatRelativeTime, formatDuration } from "@/frontend/lib/utils";

type ResultRow = EvaluationRun["results"][number];

const badgeVariant = (status: EvaluationRun["status"]): "success" | "info" | "warning" | "danger" =>
  status === "completed" ? "success" : status === "running" ? "info" : status === "partial" ? "warning" : "danger";

export default function EvaluationDetailPage() {
  const params = useParams();
  const evaluationId = params.id as string;
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    setError(false);
    fetch(`/api/evaluations/${encodeURIComponent(evaluationId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && j.run) {
          setRun(j.run as EvaluationRun);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  const results = useMemo(() => run?.results ?? [], [run]);
  const filtered = filter === "all" ? results : results.filter((r) => r.model === filter);
  const modelOptions = useMemo(() => Array.from(new Set(results.map((r) => r.model))), [results]);

  const ok = results.filter((r) => r.status === "success");
  const errCount = results.length - ok.length;
  const scoredOk = ok.filter((r) => typeof r.scores?.accuracy === "number" && Number.isFinite(r.scores.accuracy));
  const avgAccuracy = scoredOk.length ? scoredOk.reduce((s, r) => s + (r.scores!.accuracy as number), 0) / scoredOk.length : undefined;
  const avgLatency = ok.length ? ok.reduce((s, r) => s + r.latency, 0) / ok.length : undefined;
  const totalCost = results.reduce((s, r) => s + (r.estimatedCost || 0), 0);
  const totalTokens = results.reduce((s, r) => s + r.totalTokens, 0);
  const successRate = results.length ? ok.length / results.length : undefined;

  const columns: Column<ResultRow>[] = [
    { key: "testCaseId", header: "Case", width: "120px", render: (_, row) => <span className="font-mono text-xs text-stone-500">{row.testCaseId}</span> },
    { key: "input", header: "Question", width: "300px", render: (_, row) => (
      <div className="max-w-xs"><p className="font-medium text-foreground line-clamp-2">{row.input}</p></div>
    )},
    { key: "model", header: "Model", width: "130px", render: (_, row) => <span className="text-stone-300">{getModelById(row.model)?.displayName || row.model}</span> },
    { key: "status", header: "Status", render: (_, row) => (
      <Badge variant={row.status === "success" ? "success" : "danger"} size="sm">{row.status === "success" ? "OK" : "Error"}</Badge>
    )},
    { key: "source", header: "Source", width: "90px", render: () => (
      <Badge variant={run?.mode === "openrouter" ? "brand" : "neutral"} size="sm">{run?.mode === "openrouter" ? "OpenRouter" : "Mock"}</Badge>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => (
      <span className="font-mono tabular-nums font-semibold">{typeof row.scores?.accuracy === "number" && Number.isFinite(row.scores.accuracy) ? formatPercent(row.scores.accuracy) : "â€”"}</span>
    )},
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      const h = row.scores?.hallucination;
      if (h === undefined || h === null) return <span className="text-stone-500">â€”</span>;
      // 1 = no hallucination, 0 = severe. Higher is better.
      return <Badge variant={h >= 0.85 ? "success" : h >= 0.7 ? "warning" : "danger"} size="sm">{formatPercent(h)}</Badge>;
    }},
    { key: "completeness", header: "Completeness", render: (_, row) => (
      <span className="font-mono tabular-nums">{typeof row.scores?.completeness === "number" && Number.isFinite(row.scores.completeness) ? formatPercent(row.scores.completeness) : "â€”"}</span>
    )},
    { key: "toxicity", header: "Toxicity", render: (_, row) => (
      <span className="font-mono tabular-nums">{typeof row.scores?.toxicity === "number" && Number.isFinite(row.scores.toxicity) ? formatPercent(row.scores.toxicity) : "â€”"}</span>
    )},
    { key: "bias", header: "Bias", render: (_, row) => (
      <span className="font-mono tabular-nums">{typeof row.scores?.bias === "number" && Number.isFinite(row.scores.bias) ? formatPercent(row.scores.bias) : "â€”"}</span>
    )},
    { key: "latency", header: "Latency", render: (_, row) => (
      <span className="font-mono text-stone-300">{row.status === "success" ? `${(row.latency / 1000).toFixed(2)}s` : "â€”"}</span>
    )},
    { key: "cost", header: "Cost", render: (_, row) => (
      <span className="font-mono text-stone-300">{row.estimatedCost != null ? formatCurrency(row.estimatedCost) : "â€”"}</span>
    )},
    { key: "actions", header: "", render: (_, row) => (
      <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" onClick={() => setSelectedResult(row)} aria-label="View details">
        <Eye className="h-4 w-4" />
      </button>
    )},
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer title="Evaluation" description="Loadingâ€¦">
          <Card className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading evaluationâ€¦</p>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageContainer title="Evaluation" description="Could not load this evaluation">
          <Card className="p-12 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-danger-400" />
            <p className="font-medium text-foreground">Failed to load evaluation</p>
            <p className="text-sm text-stone-400">The evaluation service did not respond. Retry or check the server.</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={load}>Retry</Button>
              <Link href="/evaluations"><Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}>All Evaluations</Button></Link>
            </div>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (notFound || !run) {
    return (
      <DashboardLayout>
        <PageContainer title="Evaluation Not Found" description="No persisted evaluation matches this id.">
          <Card className="p-12 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />
            <p className="text-foreground font-medium">Evaluation <span className="font-mono text-accent-400">{evaluationId}</span> was not found.</p>
            <div className="flex justify-center gap-2">
              <Link href="/evaluations"><Button variant="primary" leftIcon={<ChevronLeft className="h-4 w-4" />}>Back to Evaluations</Button></Link>
            </div>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const metricCards = [
    { label: "Success Rate", value: successRate !== undefined ? formatPercent(successRate) : "â€”", icon: <Target className="h-5 w-5" /> },
    { label: "Avg Accuracy", value: avgAccuracy !== undefined ? formatPercent(avgAccuracy) : "â€”", icon: <Shield className="h-5 w-5" /> },
    { label: "Avg Latency", value: avgLatency !== undefined ? `${(avgLatency / 1000).toFixed(2)}s` : "â€”", icon: <Clock className="h-5 w-5" /> },
    { label: "Total Cost", value: formatCurrency(totalCost), icon: <DollarSign className="h-5 w-5" /> },
    { label: "Total Tokens", value: formatNumber(totalTokens), icon: <BarChart2 className="h-5 w-5" /> },
    { label: "Failed", value: formatNumber(errCount), icon: <AlertCircle className="h-5 w-5" /> },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title={`Evaluation ${run.id.slice(0, 16)}`}
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
            <Badge variant="neutral" size="sm"><Clock className="h-3 w-3" /> Started {formatRelativeTime(run.startedAt)}</Badge>
            {run.completedAt && (
              <Badge variant="neutral" size="sm"><CheckCircle className="h-3 w-3" /> {formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())}</Badge>
            )}
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

        <Section title="Case Results" description={`${results.length} evaluations â€¢ ${ok.length} succeeded â€¢ ${errCount} failed`}>
          <div className="flex items-center gap-3 mb-4">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
              <option value="all">All Models</option>
              {modelOptions.map((id) => <option key={id} value={id}>{getModelById(id)?.displayName || id}</option>)}
            </select>
            <span className="text-xs text-stone-500">Click the eye icon to expand a case.</span>
          </div>
          <Table columns={columns} data={filtered} keyExtractor={(row) => `${row.model}-${row.testCaseId}`} hoverable emptyMessage="No results in this evaluation." />
        </Section>

        <Section title="Config" description="How this evaluation was executed">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Provider Mode</p><p className="font-mono text-sm">{run.mode === "openrouter" ? "OpenRouter" : "Mock"}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Judge</p><p className="font-mono text-sm truncate">{run.judgeModelId}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Temperature</p><p className="font-mono text-sm">{run.temperature ?? "â€”"}</p></div>
            <div className="rounded-xl bg-[#0F0F0F] border border-[#2A2A28] p-3"><p className="text-xs text-stone-500">Run Created</p><p className="font-mono text-sm">{formatRelativeTime(run.createdAt)}</p></div>
          </div>
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
                    <p className="text-sm text-stone-400">Source</p>
                    <Badge variant={run.mode === "openrouter" ? "brand" : "neutral"} size="sm">{run.mode === "openrouter" ? "OpenRouter" : "Mock"}</Badge>
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
                  <div className="pt-4 border-t border-[#2A2A28]">
                    <p className="text-sm text-stone-400 mb-3">Judge Scores</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(selectedResult.scores).map(([k, v]) => (
                        <div key={k} className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]">
                          <p className="text-xs text-stone-500 capitalize">{k}</p>
                          <p className="font-mono font-semibold text-foreground">{typeof v === "number" ? formatPercent(v) : "â€”"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2A2A28]">
                  <MetricCard label="Tokens" value={formatNumber(selectedResult.totalTokens)} icon={<BarChart2 className="h-5 w-5" />} />
                  <MetricCard label="Latency" value={selectedResult.status === "success" ? `${(selectedResult.latency / 1000).toFixed(2)}s` : "â€”"} icon={<Clock className="h-5 w-5" />} />
                  <MetricCard label="Cost" value={selectedResult.estimatedCost != null ? formatCurrency(selectedResult.estimatedCost) : "â€”"} icon={<DollarSign className="h-5 w-5" />} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}