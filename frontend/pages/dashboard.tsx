"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChartComponent,
  LineChartComponent,
  ScatterChartComponent,
  MetricCard,
  Sparkline,
} from "@/components/charts/ChartComponents";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, type Column } from "@/components/ui/Table";
import {
  LayoutDashboard,
  FlaskConical,
  Database,
  Cpu,
  Target,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ExternalLink,
  MoreVertical,
  ChevronRight,
  Plus,
  Loader2,
} from "@/components/layout/Icons";
import { DashboardLayout, PageContainer, Section, Grid } from "@/components/layout/DashboardLayout";
import { formatNumber, formatCurrency, formatPercent, formatRelativeTime } from "@/frontend/lib/utils";
import {
  aggregateComparison,
  aggregatePerModel,
  averageMetric,
  type ComparisonRow,
} from "@/lib/ai/runAggregation";
import type { EvaluationRun } from "@/lib/evaluations/types";
import type { Experiment, Dataset } from "@/types";
import type { RunResultLike } from "@/lib/ai/runAggregation";

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.85]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.98]);

  return (
    <motion.div
      ref={heroRef}
      style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[1.75rem] border border-[#2A2A28] bg-[#1A1A1E] p-8 lg:p-10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/[0.07] via-transparent to-[#1A1A1E] pointer-events-none" />
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#C8A96E]/[0.06] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/[0.02] blur-3xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <Badge variant="brand" size="sm" className="mb-3">RittikEvalOpsAI â€¢ Premium AI Evaluation Platform</Badge>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">Evaluate. Compare. <span className="text-gradient-brand">Ship with confidence.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-stone-400">Benchmark GPT, Claude, Llama, Qwen and 200+ models across accuracy, faithfulness, hallucination, latency and cost â€” all in one elegant workspace.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/experiments/new"><Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>New Experiment</Button></Link>
            <Link href="/models"><Button variant="outline" leftIcon={<ExternalLink className="h-4 w-4" />}>Explore Models</Button></Link>
          </div>
        </div>
        <div className="hidden lg:block text-right">
          <p className="text-sm text-stone-400">Last updated</p>
          <p className="font-mono text-sm text-foreground">{new Date().toLocaleDateString()}</p>
          <div className="mt-4 flex items-center justify-end gap-2"><span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" /><span className="text-xs text-stone-400">All systems operational</span></div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json().catch(() => ({}))),
      fetch("/api/experiments").then((r) => r.json().catch(() => ({}))),
      fetch("/api/evaluations").then((r) => r.json().catch(() => ({}))),
      fetch("/api/datasets").then((r) => r.json().catch(() => ({}))),
    ]).then(([session, exps, evals, ds]) => {
      if (cancelled) return;
      if (session.status === "success" && session.user) setUser(session.user);
      if (exps.status === "success" && Array.isArray(exps.experiments)) setExperiments(exps.experiments);
      if (evals.status === "success" && Array.isArray(evals.runs)) setRuns(evals.runs);
      if (ds.status === "success" && Array.isArray(ds.datasets)) setDatasets(ds.datasets);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  const cutoffDate = useMemo(() => {
    if (timeRange === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(timeRange));
    return d;
  }, [timeRange]);

  const filteredRuns = useMemo(() => {
    let r = runs;
    if (cutoffDate) r = r.filter((run) => new Date(run.createdAt) >= cutoffDate);
    return r;
  }, [runs, cutoffDate]);

  const allResults = useMemo(() => filteredRuns.flatMap((r) => r.results), [filteredRuns]);

  const comparisonRows = useMemo(() => aggregateComparison(allResults), [allResults]);

  const filteredComparison = useMemo(() => {
    if (modelFilter === "all") return comparisonRows;
    return comparisonRows.filter((r) => r.modelId.toLowerCase().includes(modelFilter.toLowerCase()));
  }, [comparisonRows, modelFilter]);

  const filteredAllResults = useMemo(() => {
    if (modelFilter === "all") return allResults;
    return allResults.filter((r) => (r.model ?? "").toLowerCase().includes(modelFilter.toLowerCase()));
  }, [allResults, modelFilter]);

  const metrics = useMemo(() => {
    const successful = filteredAllResults.filter((r) => r.status === "success");
    const scoredAcc = comparisonRows.filter((r) => r.accuracy !== null);
    const avgAcc = scoredAcc.length ? scoredAcc.reduce((s, r) => s + (r.accuracy as number), 0) / scoredAcc.length : null;
    const avgHall = averageMetric(filteredAllResults, "hallucination");
    const latencies = successful.filter((r) => typeof r.latency === "number").map((r) => r.latency);
    const avgLat = latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null;
    const totalCost = filteredAllResults.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);

    return [
      { label: "Models Tested", value: filteredComparison.length, icon: <Cpu className="h-6 w-6" /> },
      { label: "Experiments", value: experiments.length, icon: <FlaskConical className="h-6 w-6" /> },
      { label: "Test Cases", value: formatNumber(filteredAllResults.length), icon: <Database className="h-6 w-6" /> },
      { label: "Avg Accuracy", value: avgAcc !== null ? formatPercent(avgAcc) : "â€”", icon: <Target className="h-6 w-6" /> },
      { label: "Hallucination Rate", value: avgHall !== null ? formatPercent(avgHall) : "â€”", icon: <AlertTriangle className="h-6 w-6" /> },
      { label: "Avg Latency", value: avgLat !== null ? `${(avgLat / 1000).toFixed(1)}s` : "â€”", icon: <Clock className="h-6 w-6" /> },
      { label: "Total Cost", value: formatCurrency(totalCost), icon: <DollarSign className="h-6 w-6" /> },
    ];
  }, [filteredAllResults, filteredComparison, experiments]);

  const recentExperiments = useMemo(() => [...experiments].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5), [experiments]);

  const experimentColumns: Column<Experiment>[] = [
    { key: "name", header: "Experiment", width: "200px", render: (_, row) => (
      <div>
        <p className="font-medium text-foreground">{row.name}</p>
        {row.description && <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">{row.description}</p>}
      </div>
    )},
    { key: "datasetName", header: "Dataset", width: "180px" },
    { key: "models", header: "Models", render: (_, row) => (
      <div className="flex flex-wrap gap-1">
        {row.models.slice(0, 3).map((m) => (
          <Badge key={m} variant="neutral" size="sm">{m.split("/").pop()?.split("-")[0]?.toUpperCase() ?? m}</Badge>
        ))}
        {row.models.length > 3 && <Badge variant="neutral" size="sm">+{row.models.length - 3}</Badge>}
      </div>
    )},
    { key: "status", header: "Status", render: (_, row) => {
      const statusConfig: Record<string, { variant: "success" | "info" | "neutral" | "danger"; icon: React.ReactNode }> = {
        completed: { variant: "success", icon: <CheckCircle className="h-3 w-3" /> },
        running: { variant: "info", icon: <span className="h-3 w-3 animate-pulse rounded-full bg-[#C8A96E]" /> },
        draft: { variant: "neutral", icon: <span className="h-3 w-3 rounded-full bg-white/20" /> },
        failed: { variant: "danger", icon: <AlertTriangle className="h-3 w-3" /> },
        cancelled: { variant: "neutral", icon: <span className="h-3 w-3 rounded-full bg-white/20" /> },
      };
      const config = statusConfig[row.status] || statusConfig.draft;
      return (
        <Badge variant={config.variant} dot>
          {config.icon} {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      );
    }},
    { key: "progress", header: "Progress", render: (_, row) => (
      <div className="w-32">
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#C8A96E] to-[#B89A5F] rounded-full transition-all duration-500" style={{ width: `${row.progress}%` }} />
        </div>
      </div>
    )},
    { key: "updatedAt", header: "Updated", render: (_, row) => formatRelativeTime(row.updatedAt) },
    { key: "actions", header: "", render: (_, row) => (
      <button type="button" className="text-stone-400 hover:text-[#F5F1EB] transition-smooth p-1" aria-label="More options" onClick={() => router.push(`/experiments/${row.id}`)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    )},
  ];

  const modelColumns: Column<ComparisonRow & { displayName: string }>[] = [
    { key: "displayName", header: "Model", render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
          {row.displayName.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-foreground">{row.displayName}</p>
          <p className="text-xs text-stone-400">{row.successful}/{row.total} passed</p>
        </div>
      </div>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => (
      <div className="flex items-center gap-2">
        <span className="font-mono tabular-nums font-semibold">{row.accuracy !== null ? formatPercent(row.accuracy) : "â€”"}</span>
        {row.accuracy !== null && <Sparkline data={[row.accuracy * 0.9, row.accuracy * 0.95, row.accuracy * 1.02, row.accuracy]} color="#C8A96E" width={60} height={20} />}
      </div>
    )},
    { key: "faithfulness", header: "Faithfulness", render: (_, row) => (
      <span className="font-mono tabular-nums">{row.faithfulness !== null ? formatPercent(row.faithfulness) : "â€”"}</span>
    )},
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      const hall = row.hallucination;
      return hall !== null ? (
        <Badge variant={hall < 0.05 ? "success" : hall < 0.1 ? "warning" : "danger"} size="sm">{formatPercent(hall)}</Badge>
      ) : <span className="text-stone-500 text-sm">â€”</span>;
    }},
    { key: "avgLatency", header: "Latency", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{row.avgLatency !== null ? `${(row.avgLatency / 1000).toFixed(1)}s` : "â€”"}</span>
    )},
    { key: "totalCost", header: "Cost", render: (_, row) => (
      <span className="font-mono tabular-nums text-stone-300">{formatCurrency(row.totalCost)}</span>
    )},
  ];

  const modelTableData = useMemo(() =>
    filteredComparison.map((r) => ({ ...r, displayName: r.modelId.split("/").pop() ?? r.modelId })),
    [filteredComparison]
  );

  const accuracyChartData = useMemo(() =>
    filteredComparison.map((r) => ({ model: r.modelId.split("/").pop() ?? r.modelId, accuracy: r.accuracy ?? 0, faithfulness: r.faithfulness ?? 0, relevance: r.relevance ?? 0 })),
    [filteredComparison]
  );

  const latencyChartData = useMemo(() =>
    filteredComparison.filter((r) => r.avgLatency !== null).map((r) => ({ model: r.modelId.split("/").pop() ?? r.modelId, latency: r.avgLatency !== null ? r.avgLatency / 1000 : 0 })),
    [filteredComparison]
  );

  const costVsQualityData = useMemo(() =>
    filteredComparison.filter((r) => r.accuracy !== null).map((r) => ({
      model: r.modelId.split("/").pop() ?? r.modelId,
      cost: r.totalCost,
      quality: r.accuracy ?? 0,
      size: r.total,
    })),
    [filteredComparison]
  );

  const hallucinationTrendData = useMemo(() => {
    if (filteredRuns.length === 0) return [];
    const byDate = new Map<string, { gpt4o: number | null; claude: number | null; llama: number | null; qwen: number | null }>();
    for (const run of [...filteredRuns].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      const date = run.createdAt.slice(0, 10);
      const existing = byDate.get(date) ?? { gpt4o: null, claude: null, llama: null, qwen: null };
      for (const r of run.results) {
        const hall = r.scores?.hallucination;
        const key = r.model.toLowerCase().includes("gpt") ? "gpt4o" : r.model.toLowerCase().includes("claude") ? "claude" : r.model.toLowerCase().includes("llama") ? "llama" : r.model.toLowerCase().includes("qwen") ? "qwen" : null;
        if (key && typeof hall === "number" && Number.isFinite(hall)) existing[key] = hall;
      }
      byDate.set(date, existing);
    }
    return Array.from(byDate.entries()).map(([date, vals]) => ({ date, ...vals }));
  }, [filteredRuns]);

  const evalDimensions = useMemo(() => {
    const dims = [
      { label: "Accuracy", key: "accuracy" },
      { label: "Faithfulness", key: "faithfulness" },
      { label: "Relevance", key: "relevance" },
      { label: "Hallucination", key: "hallucination" },
      { label: "Safety", key: "safety" },
      { label: "Latency (s)", key: "latency" },
    ];
    return dims.map((d) => {
      if (d.key === "latency") {
        const successful = filteredAllResults.filter((r) => r.status === "success" && typeof r.latency === "number");
        const val = successful.length ? successful.reduce((s, r) => s + r.latency, 0) / successful.length / 1000 : null;
        return { ...d, value: val, trend: 0 };
      }
      const val = averageMetric(filteredAllResults, d.key);
      return { ...d, value: val, trend: 0 };
    });
  }, [filteredAllResults]);

  const bestModel = filteredComparison[0];

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-[#C8A96E]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome, {firstName}</h2>
            <p className="text-sm text-stone-400">Here&apos;s your evaluation workspace overview.</p>
          </div>
          {user?.email && <span className="font-mono text-xs text-stone-500">{user.email}</span>}
        </div>
        <HeroSection />

        <div className="flex flex-wrap items-center gap-3">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
            <option value="all">All Models</option>
            {comparisonRows.map((r) => (
              <option key={r.modelId} value={r.modelId}>{r.modelId.split("/").pop()}</option>
            ))}
          </select>
          <span className="text-xs text-stone-500">Filters update metrics & charts below</span>
        </div>

        <motion.div
          key={timeRange + modelFilter}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <MetricCard {...metric} change={0} trend="neutral" />
            </motion.div>
          ))}
        </motion.div>

        {filteredComparison.length > 0 && (
          <Grid columns={3} gap={6}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
              <Section title="Model Accuracy Comparison" description="Accuracy, faithfulness, and relevance scores across models">
                <BarChartComponent data={accuracyChartData} xKey="model" yKeys={["accuracy", "faithfulness", "relevance"]} height={320} />
              </Section>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Section title="Hallucination Trend" description="Hallucination rate over time (lower is better)">
                {hallucinationTrendData.length > 0 ? (
                  <LineChartComponent data={hallucinationTrendData} xKey="date" yKeys={["gpt4o", "claude", "llama", "qwen"]} height={320} fillArea={true} />
                ) : (
                  <Card className="h-full flex items-center justify-center py-20"><p className="text-sm text-stone-500">No hallucination scores recorded yet.</p></Card>
                )}
              </Section>
            </motion.div>
          </Grid>
        )}

        {costVsQualityData.length > 0 && (
          <Grid columns={2} gap={6}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Section title="Cost vs Quality" description="Model cost vs accuracy score">
                <ScatterChartComponent data={costVsQualityData} xKey="cost" yKey="quality" zKey="size" labelKey="model" xLabel="Total Cost ($)" yLabel="Accuracy Score" height={320} />
              </Section>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Section title="Latency Comparison" description="Average response latency across models">
                {latencyChartData.length > 0 ? (
                  <BarChartComponent data={latencyChartData} xKey="model" yKeys={["latency"]} colors={["#C8A96E"]} height={320} showLegend={false} />
                ) : (
                  <Card className="h-full flex items-center justify-center py-20"><p className="text-sm text-stone-500">No latency data recorded yet.</p></Card>
                )}
              </Section>
            </motion.div>
          </Grid>
        )}

        <Grid columns={2} gap={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
            <Section title="Recent Experiments" description="Latest evaluation experiments and their status">
              <Table columns={experimentColumns} data={recentExperiments} keyExtractor={(row) => row.id} hoverable={true} emptyMessage="No experiments yet. Create your first experiment to get started." />
            </Section>
          </motion.div>
        </Grid>

        <Grid columns={2} gap={6}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Section title="Dataset Overview" description="Available datasets for evaluation">
              <Table
                columns={[
                  { key: "name", header: "Dataset", render: (_, row) => (<div><p className="font-medium text-foreground">{row.name}</p><p className="text-xs text-stone-400">v{row.version} Â· {row.format.toUpperCase()}</p></div>) },
                  { key: "testCases", header: "Test Cases", render: (_, row) => formatNumber(row.testCases) },
                  { key: "status", header: "Status", render: (_, row) => { const c = { ready: "success" as const, processing: "info" as const, error: "danger" as const, uploading: "warning" as const }; return <Badge variant={c[row.status] || "neutral"} dot>{row.status}</Badge>; } },
                  { key: "lastUpdated", header: "Updated", render: (_, row) => formatRelativeTime(row.lastUpdated) },
                ]}
                data={datasets}
                keyExtractor={(row) => row.id}
                hoverable={true}
                emptyMessage="No datasets yet. Upload one to get started."
              />
            </Section>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Section title={bestModel ? "Best Model" : "Recommended Model"} description={bestModel ? "Top performer by accuracy" : "Based on your evaluation criteria"}>
              <Card variant="elevated" className="h-full p-6">
                {bestModel ? (
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-2xl font-bold text-[#F5F1EB] flex-shrink-0">
                      {(bestModel.modelId.split("/").pop() ?? bestModel.modelId).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{bestModel.modelId.split("/").pop()}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {bestModel.accuracy !== null && <Badge variant="brand" size="sm">Accuracy: {formatPercent(bestModel.accuracy)}</Badge>}
                        {bestModel.hallucination !== null && <Badge variant={bestModel.hallucination < 0.05 ? "success" : "warning"} size="sm">{bestModel.hallucination < 0.05 ? "Low" : "Moderate"} Hallucination</Badge>}
                        {bestModel.avgLatency !== null && <Badge variant="info" size="sm">{(bestModel.avgLatency / 1000).toFixed(1)}s avg latency</Badge>}
                      </div>
                      <div className="mt-4 flex items-center gap-4 text-sm text-stone-400">
                        <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {formatCurrency(bestModel.totalCost)} total</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> {bestModel.successful}/{bestModel.total} passed</span>
                      </div>
                      <Link href="/comparison"><Button variant="primary" size="sm" className="mt-4" leftIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>View Comparison</Button></Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Cpu className="h-10 w-10 text-stone-600 mb-3" />
                    <p className="text-sm text-stone-400">Run an evaluation to see model recommendations.</p>
                    <Link href="/experiments/new"><Button variant="primary" size="sm" className="mt-3" leftIcon={<Plus className="h-4 w-4" />}>Create Experiment</Button></Link>
                  </div>
                )}
              </Card>
            </Section>
          </motion.div>
        </Grid>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Section title="Evaluation Dimensions" description="Comprehensive metrics across all models">
            <Card variant="elevated" className="h-full p-6 space-y-4">
              {evalDimensions.map((metric, index) => (
                <motion.div key={metric.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.05 }} className="flex items-center justify-between">
                  <span className="text-sm text-stone-300">{metric.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums font-semibold text-lg">
                      {metric.value !== null ? (metric.key === "latency" ? metric.value.toFixed(1) + "s" : formatPercent(metric.value)) : "â€”"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </Card>
          </Section>

          <Section title="Top Models" description="Models ranked by accuracy">
            <Card variant="elevated" className="h-full p-6">
              {modelTableData.length > 0 ? (
                <div className="space-y-3">
                  {modelTableData.slice(0, 5).map((m, i) => (
                    <div key={m.modelId} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-stone-500 w-4">{i + 1}</span>
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">{m.displayName.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{m.displayName}</p>
                        <p className="text-xs text-stone-400">{m.accuracy !== null ? formatPercent(m.accuracy) : "â€”"} accuracy Â· {m.successful}/{m.total}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Cpu className="h-8 w-8 text-stone-600 mb-2" />
                  <p className="text-sm text-stone-400">No model data yet.</p>
                </div>
              )}
            </Card>
          </Section>

          <Section title="Quick Actions" description="Common tasks and shortcuts">
            <div className="space-y-3">
              {[
                { label: "Create New Experiment", icon: Plus, href: "/experiments/new", primary: true },
                { label: "Upload Dataset", icon: Database, href: "/datasets", primary: false },
                { label: "Compare Models", icon: Cpu, href: "/comparison", primary: false },
                { label: "View Evaluations", icon: ExternalLink, href: "/evaluations", primary: false },
                { label: "Model Registry", icon: Cpu, href: "/models", primary: false },
                { label: "Settings", icon: LayoutDashboard, href: "/settings", primary: false },
              ].map((action, index) => (
                <motion.button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className={`w-full ${action.primary ? "btn-primary" : "btn-secondary"} justify-start gap-3 text-left py-3 cursor-pointer`}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ x: 4 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                >
                  <action.icon className="h-5 w-5" />
                  <span>{action.label}</span>
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </motion.button>
              ))}
            </div>
          </Section>
        </motion.div>
      </PageContainer>
    </DashboardLayout>
  );
}
