"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { ScatterChartComponent, BarChartComponent } from "@/components/charts/ChartComponents";
import { getModelById } from "@/lib/ai/models";
import type { EvaluationRun } from "@/lib/evaluations/types";
import { aggregateComparison, type ComparisonRow } from "@/lib/ai/runAggregation";
import {
  Target,
  Shield,
  ArrowUpRight,
  AlertCircle,
  Clock,
  DollarSign,
  CheckCircle,
  TrendingUp,
  Zap,
  Search,
  ChevronDown,
  Eye,
  ExternalLink,
  Download,
  Share2,
  X,
  Loader2,
  BarChart2,
  ListChecks,
  ShieldAlert,
  Scale,
} from "@/components/layout/Icons";
import { formatNumber, formatCurrency, formatPercent } from "@/frontend/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface CompRow {
  modelId: string;
  modelName: string;
  provider: string;
  resultsCount: number;
  metrics: {
    accuracy: number | null;
    faithfulness: number | null;
    relevance: number | null;
    hallucination: number | null;
    completeness: number | null;
    toxicity: number | null;
    bias: number | null;
    latency: number | null;
    cost: number;
    tokens: number;
    safety: number | null;
    successRate: number;
  };
}

const metricDefs: Array<{ key: keyof CompRow["metrics"]; label: string; icon: React.ReactNode; higherBetter: boolean; format: (v: number | null) => string }> = [
  { key: "accuracy", label: "Accuracy", icon: <Target className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "faithfulness", label: "Faithfulness", icon: <Shield className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "relevance", label: "Relevance", icon: <ArrowUpRight className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "hallucination", label: "Hallucination", icon: <AlertCircle className="h-4 w-4" />, higherBetter: false, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "completeness", label: "Completeness", icon: <ListChecks className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "toxicity", label: "Toxicity", icon: <ShieldAlert className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "bias", label: "Bias", icon: <Scale className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "latency", label: "Latency (s)", icon: <Clock className="h-4 w-4" />, higherBetter: false, format: (v) => (v === null ? "N/A" : `${(v / 1000).toFixed(1)}s`) },
  { key: "cost", label: "Cost ($)", icon: <DollarSign className="h-4 w-4" />, higherBetter: false, format: (v) => (v === null ? "N/A" : formatCurrency(v)) },
  { key: "tokens", label: "Tokens", icon: <Zap className="h-4 w-4" />, higherBetter: false, format: (v) => (v === null ? "N/A" : formatNumber(v)) },
  { key: "safety", label: "Safety", icon: <CheckCircle className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
  { key: "successRate", label: "Success", icon: <CheckCircle className="h-4 w-4" />, higherBetter: true, format: (v) => (v === null ? "N/A" : formatPercent(v)) },
];

export default function ComparisonPage() {
  const { success, error: toastError } = useToast();
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "radar" | "scatter">("table");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "accuracy", direction: "desc" });
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const loadRuns = () => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/evaluations")
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && Array.isArray(j.runs)) {
          const all = j.runs as EvaluationRun[];
          setRuns(all);
          const latest = all[0];
          if (latest) {
            const models = Array.from(new Set(latest.results.map((r) => r.model))).slice(0, 4);
            setSelectedModels(models);
          }
        } else {
          setLoadError(j.error || "Failed to load runs.");
        }
      })
      .catch(() => setLoadError("Could not reach the server. Check your connection."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadRuns(); }, []);

  const exportComparison = () => {
    if (runs.length === 0) {
      toastError("Nothing to export", "Run an experiment to generate comparison data first.");
      return;
    }
    const payload = { runs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-comparison-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success("Export complete", "Comparison run data downloaded as JSON.");
  };

  const shareComparison = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      success("Link copied", "Comparison link copied to clipboard.");
    } catch {
      toastError("Copy failed", "Could not copy the link.");
    }
  };

  const latestRun = runs[0];

  const allComparisonRows = useMemo(() => {
    const src = latestRun ?? runs[0];
    if (!src) return [] as CompRow[];
    return aggregateComparison(src.results).map((row: ComparisonRow) => {
      const name = getModelById(row.modelId)?.displayName || row.modelId;
      return {
        modelId: row.modelId,
        modelName: name,
        provider: getModelById(row.modelId)?.provider || "â€”",
        resultsCount: row.total,
        metrics: {
          accuracy: row.accuracy,
          faithfulness: row.faithfulness,
          relevance: row.relevance,
          hallucination: row.hallucination,
          completeness: row.completeness,
          toxicity: row.toxicity,
          bias: row.bias,
          latency: row.avgLatency,
          cost: row.totalCost,
          tokens: row.totalTokens,
          safety: row.safety,
          successRate: row.successRate,
        },
      };
    });
  }, [runs]);

  const allModelIds = useMemo(() => allComparisonRows.map((r) => r.modelId), [allComparisonRows]);
  const availableModels = allModelIds.filter((id) => !selectedModels.includes(id));

  const toggleModel = (id: string) =>
    setSelectedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const comparisonData = allComparisonRows.filter((r) => selectedModels.includes(r.modelId));

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedData = [...comparisonData].sort((a, b) => {
    const aVal = a.metrics[sortConfig.key as keyof CompRow["metrics"]];
    const bVal = b.metrics[sortConfig.key as keyof CompRow["metrics"]];
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const metrics: Array<{ key: keyof CompRow["metrics"]; label: string; higherBetter: boolean }> = metricDefs.map(({ key, label, higherBetter }) => ({ key, label, higherBetter }));

  const tableColumns: Column<CompRow>[] = [
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
    ...metrics.map((m) => ({
      key: m.key,
      header: m.label,
      sortable: true,
      render: (_: unknown, row: CompRow) => {
        const value = row.metrics[m.key];
        const formatted = metricDefs.find((d) => d.key === m.key)?.format(value) ?? String(value);
        const isBest =
          value !== null &&
          comparisonData.length > 1 &&
          comparisonData.every((r) => {
            const other = r.metrics[m.key];
            if (other === null || other === undefined) return true;
            if (m.key === "cost") return other >= value;
            return m.higherBetter ? other <= value : other >= value;
          });
        return (
          <span className={`font-mono tabular-nums ${isBest ? "font-semibold text-[#C8A96E]" : ""}`}>
            {formatted}
            {isBest && <CheckCircle className="h-3 w-3 ml-1 inline" />}
          </span>
        );
      },
    })),
    { key: "resultsCount", header: "Results", render: (_, row) => <span className="font-mono text-stone-400">{formatNumber(row.resultsCount)}</span> },
    { key: "actions", header: "", render: () => (
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" aria-label="View details">
          <Eye className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded-lg text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-smooth" aria-label="View evaluations">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    )},
  ];

  const filteredAvailable = availableModels.filter((id) => getModelById(id)?.displayName.toLowerCase().includes(query.toLowerCase()) || id.toLowerCase().includes(query.toLowerCase()));

  const scatterData = comparisonData
    .filter((r) => r.metrics.cost !== null && r.metrics.accuracy !== null)
    .map((r) => ({
      cost: Number(r.metrics.cost.toFixed(4)),
      quality: r.metrics.accuracy as number,
      size: Math.max(4, Math.round(Math.max(0, r.metrics.successRate) * 20)),
      model: (r.modelName.split(" ")[0] || r.modelName).replace(/[^a-z0-9]/gi, ""),
    }));
  const latencyData = comparisonData
    .filter((r) => r.metrics.latency !== null)
    .map((r) => ({ model: r.modelName.split(" ")[0] || r.modelName, latency: Number(((r.metrics.latency as number) / 1000).toFixed(2)) }));
  const qualityData = comparisonData
    .filter((r) => r.metrics.accuracy !== null)
    .map((r) => ({ model: r.modelName.split(" ")[0] || r.modelName, accuracy: r.metrics.accuracy, faithfulness: r.metrics.faithfulness, relevance: r.metrics.relevance }));

  const insights = useMemo(() => {
    if (!comparisonData.length) return null;
    const withAccuracy = comparisonData.filter((r) => r.metrics.accuracy !== null);
    const withLatency = comparisonData.filter((r) => r.metrics.latency !== null);
    const withCost = comparisonData.filter((r) => r.metrics.cost > 0);
    const bestAccuracy = withAccuracy.length
      ? withAccuracy.reduce((best, r) => (r.metrics.accuracy! > best.metrics.accuracy! ? r : best), withAccuracy[0])
      : null;

    // Overall winner: greatest average across the judge metrics actually scored
    // (all are 1=best, higher-better). Only models scored on at least one judge
    // metric are eligible; missing metrics are excluded from that model's mean,
    // never counted as 0.
    const judgeKeys: (keyof CompRow["metrics"])[] = ["accuracy", "faithfulness", "relevance", "hallucination", "completeness", "toxicity", "bias", "safety"];
    const scored = comparisonData
      .map((r) => {
        const vals = judgeKeys.map((k) => r.metrics[k]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
        return vals.length ? { row: r, overall: vals.reduce((s, v) => s + v, 0) / vals.length } : null;
      })
      .filter((x): x is { row: CompRow; overall: number } => x !== null);
    const bestOverall = scored.length ? scored.reduce((best, x) => (x.overall > best.overall ? x : best), scored[0]) : null;

    const lowestCost = comparisonData.reduce((best, r) => (r.metrics.cost < best.metrics.cost ? r : best), comparisonData[0]);
    const fastest = withLatency.length
      ? withLatency.reduce((best, r) => (r.metrics.latency! < best.metrics.latency! ? r : best), withLatency[0])
      : null;
    const bestValue = withCost.length
      ? withCost.reduce((best, r) => {
          const ratio = r.metrics.accuracy !== null && r.metrics.accuracy !== null ? r.metrics.accuracy / r.metrics.cost : -Infinity;
          const bestRatio = best.metrics.accuracy !== null ? best.metrics.accuracy / best.metrics.cost : -Infinity;
          return ratio > bestRatio ? r : best;
        }, withCost[0])
      : null;
    return { bestAccuracy, bestOverall, lowestCost, fastest, bestValue };
  }, [comparisonData]);

  return (
    <DashboardLayout>
      <PageContainer
        title="Model Comparison"
        description="Compare real evaluated models across metrics â€” data from the latest run"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={exportComparison}>Export</Button>
            <Button variant="ghost" size="sm" leftIcon={<Share2 className="h-3.5 w-3.5" />} onClick={shareComparison}>Share</Button>
          </div>
        }
      >
        {loading ? (
          <Card className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading runsâ€¦</p>
          </Card>
        ) : allComparisonRows.length === 0 ? (
          <Card className="p-12 text-center space-y-2">
            {loadError ? (
              <>
                <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
                <p className="font-medium text-foreground">Failed to load comparison data</p>
                <p className="text-sm text-stone-400">{loadError}</p>
                <div className="pt-2"><Button variant="outline" size="sm" onClick={loadRuns}>Retry</Button></div>
              </>
            ) : (
              <>
                <BarChart2 className="h-8 w-8 mx-auto text-stone-600" />
                <p className="font-medium text-foreground">Nothing to compare yet</p>
                <p className="text-sm text-stone-400">Run an experiment with multiple models to compare real metrics here.</p>
              </>
            )}
          </Card>
        ) : (
          <>
            <Section>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="inline-flex self-start sm:self-auto items-center gap-1 bg-white/[0.04] rounded-xl p-1" role="group" aria-label="View mode">
                  {["table", "radar", "scatter"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as "table" | "radar" | "scatter")}
                      aria-pressed={viewMode === mode}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
                        viewMode === mode ? "bg-white/[0.06] text-foreground" : "text-stone-400 hover:text-[#F5F1EB]"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-stone-500 sm:ml-auto">Based on {formatNumber(latestRun?.total ?? 0)} evaluations from run {latestRun?.id.slice(0, 16)}</p>
              </div>

              {insights?.bestOverall && comparisonData.length > 1 && (
                <Card variant="elevated" className="p-5 mb-6 border-l-4 border-[#C8A96E]">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-lg font-bold text-[#F5F1EB] flex-shrink-0">
                      {insights.bestOverall.row.modelName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">Best Overall â€” {insights.bestOverall.row.modelName}</h4>
                        <Badge variant="success" size="sm">Top evaluated model</Badge>
                      </div>
                      <p className="text-sm text-stone-400 mt-0.5">
                        Highest average across scored evaluation metrics at {formatPercent(insights.bestOverall.overall)} â€” compare all seven dimensions below.
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end text-sm">
                      <span className="text-stone-400">Mean judge score</span>
                      <span className="font-mono text-lg font-bold text-[#C8A96E]">{formatPercent(insights.bestOverall.overall)}</span>
                    </div>
                  </div>
                </Card>
              )}

              {viewMode === "table" && (
                <Table
                  columns={tableColumns.map((c) => ({
                    ...c,
                    header: c.sortable
                      ? (
                        <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 hover:text-[#F5F1EB] transition-smooth">
                          {c.header}
                          {sortConfig.key === c.key && (
                            <ChevronDown className={`h-3 w-3 ${sortConfig.direction === "desc" ? "" : "rotate-180"}`} />
                          )}
                        </button>
                      )
                      : c.header,
                  }))}
                  data={sortedData}
                  keyExtractor={(row) => row.modelId}
                  hoverable
                />
              )}

              {viewMode === "radar" && (
                <Card variant="elevated" className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Radar Chart â€” Multi-Dimensional Comparison</h3>
                  <RadarChart data={comparisonData} />
                </Card>
              )}

              {viewMode === "scatter" && (
                <ScatterChartComponent
                  data={scatterData}
                  xKey="cost"
                  yKey="quality"
                  zKey="size"
                  labelKey="model"
                  title="Cost vs Quality"
                  subtitle="Model cost vs accuracy (bubble size = success rate)"
                  xLabel="Cost ($)"
                  yLabel="Accuracy"
                  height={500}
                />
              )}
            </Section>

            <Section title="Model Selection" description="Choose which evaluated models to compare">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedModels.map((id) => (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-xl border border-[#2A2A28]"
                    >
                      <div className="h-6 w-6 rounded bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
                        {(getModelById(id)?.displayName || id).charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{getModelById(id)?.displayName || id}</span>
                      <button onClick={() => toggleModel(id)} className="p-1 text-stone-400 hover:text-[#F5F1EB] transition-smooth">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>

                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    placeholder="Filter models..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="input pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredAvailable.length === 1) toggleModel(filteredAvailable[0]);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {allModelIds.map((id) => {
                    const row = allComparisonRows.find((r) => r.modelId === id);
                    const isSelected = selectedModels.includes(id);
                    const filteredOut = query && !(getModelById(id)?.displayName.toLowerCase().includes(query.toLowerCase()) || id.toLowerCase().includes(query.toLowerCase()));
                    if (filteredOut) return null;
                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-smooth ${
                          isSelected ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-[#2A2A28] hover:border-brand-500/30 hover:bg-white/[0.04]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModel(id)}
                          className="h-4 w-4 text-[#C8A96E] border-[#3A3A38] bg-white/[0.04] focus:ring-[#C8A96E]"
                        />
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB] flex-shrink-0">
                          {(getModelById(id)?.displayName || id).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{getModelById(id)?.displayName || id}</p>
                          <p className="text-xs text-stone-400">{getModelById(id)?.provider || "â€”"} â€¢ {row?.resultsCount ?? 0} results</p>
                        </div>
                        {row && <Badge variant="neutral" size="sm">{row.metrics.accuracy !== null ? formatPercent(row.metrics.accuracy) : "N/A"}</Badge>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Section>

            {comparisonData.length > 0 && (
              <>
                <Section title="Detailed Metrics Breakdown" description="Deep dive into each evaluation dimension">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <BarChartComponent
                      data={qualityData}
                      xKey="model"
                      yKeys={["accuracy", "faithfulness", "relevance"]}
                      title="Quality Metrics"
                      subtitle="Accuracy, faithfulness, and relevance scores"
                      height={350}
                    />
                    <BarChartComponent
                      data={latencyData}
                      xKey="model"
                      yKeys={["latency"]}
                      colors={["#C8A96E"]}
                      title="Latency Comparison"
                      subtitle="Average response latency across models (seconds)"
                      height={350}
                      showLegend={false}
                    />
                  </div>
                </Section>

                <Section title="Cost vs Quality" description="Optimal cost/performance trade-off of the latest run">
                  <ScatterChartComponent
                    data={scatterData}
                    xKey="cost"
                    yKey="quality"
                    zKey="size"
                    labelKey="model"
                    title="Cost vs Quality"
                    subtitle="Model cost vs accuracy score (bubble size = success rate)"
                    xLabel="Cost ($)"
                    yLabel="Accuracy Score"
                    height={400}
                  />
                </Section>
              </>
            )}

            {insights && (
              <Section title="Quick Insights" description="Automated analysis of the latest run">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {insights.bestAccuracy && (
                    <Card variant="elevated" className="p-6 border-l-4 border-brand-500">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#C8A96E]/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-[#C8A96E]" /></div>
                        <div>
                          <h4 className="font-semibold text-foreground">Best Accuracy</h4>
                          <p className="text-sm text-stone-400 mt-1">{insights.bestAccuracy.modelName} leads with {formatPercent(insights.bestAccuracy.metrics.accuracy as number)} accuracy on {formatNumber(insights.bestAccuracy.resultsCount)} results.</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {insights.bestValue && (
                    <Card variant="elevated" className="p-6 border-l-4 border-accent-500">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent-500/20 flex items-center justify-center"><DollarSign className="h-5 w-5 text-accent-400" /></div>
                        <div>
                          <h4 className="font-semibold text-foreground">Most Cost-Effective</h4>
                          <p className="text-sm text-stone-400 mt-1">{insights.bestValue.modelName} offers the best accuracy-per-dollar in this run ({formatCurrency(insights.bestValue.metrics.cost)}).</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {insights.fastest && (
                    <Card variant="elevated" className="p-6 border-l-4 border-success-500">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-success-500/20 flex items-center justify-center"><Zap className="h-5 w-5 text-success-400" /></div>
                        <div>
                          <h4 className="font-semibold text-foreground">Fastest</h4>
                          <p className="text-sm text-stone-400 mt-1">{insights.fastest.modelName} at {((insights.fastest.metrics.latency as number) / 1000).toFixed(1)}s average latency.</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </Section>
            )}
          </>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

function RadarChart({ data }: { data: CompRow[] }) {
  const axes = [
    { key: "accuracy" as const, label: "Accuracy", max: 1 },
    { key: "faithfulness" as const, label: "Faithfulness", max: 1 },
    { key: "relevance" as const, label: "Relevance", max: 1 },
    { key: "hallucination" as const, label: "Low Hallucination", max: 1, invert: true },
    { key: "completeness" as const, label: "Completeness", max: 1 },
    { key: "toxicity" as const, label: "Toxicity", max: 1 },
    { key: "bias" as const, label: "Bias", max: 1 },
    { key: "latency" as const, label: "Low Latency", max: 5000, invert: true },
    { key: "cost" as const, label: "Low Cost", max: 0.1, invert: true },
    { key: "safety" as const, label: "Safety", max: 1 },
  ];

  const colors = ["#C8A96E", "#f59e0b", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4"];

  // Models with any missing scored metric cannot be drawn honestly on a radar
  // polygon (missing axes must not be plotted as 0). Only include models that
  // have a value for EVERY axis; the table still shows their N/A values.
  const complete = data.filter((m) => axes.every((axis) => {
    const v = m.metrics[axis.key];
    return v !== null && v !== undefined && Number.isFinite(v);
  }));

  if (complete.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-stone-500">
        Insufficient scored metrics to draw a radar chart â€” models with failed or missing evaluations are hidden.
      </div>
    );
  }

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full mx-auto" style={{ maxWidth: 400, maxHeight: 400 }}>
      <defs>
        {axes.map((_, i) => (
          <linearGradient key={i} id={`radar-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors[i]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors[i]} stopOpacity={0.05} />
          </linearGradient>
        ))}
      </defs>
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
        <polygon
          key={level}
          points={axes.map((_, i) => {
            const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
            const radius = level * 150;
            return `${200 + radius * Math.cos(angle)},${200 + radius * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}
      {axes.map((axis, i) => (
        <g key={i}>
          <line
            x1={200}
            y1={200}
            x2={200 + 150 * Math.cos((i / axes.length) * 2 * Math.PI - Math.PI / 2)}
            y2={200 + 150 * Math.sin((i / axes.length) * 2 * Math.PI - Math.PI / 2)}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          <text
            x={200 + 170 * Math.cos((i / axes.length) * 2 * Math.PI - Math.PI / 2)}
            y={200 + 170 * Math.sin((i / axes.length) * 2 * Math.PI - Math.PI / 2)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.6)"
            fontFamily="system-ui"
          >
            {axis.label}
          </text>
        </g>
      ))}
      {complete.map((model, modelIndex) => (
        <polygon
          key={model.modelId}
          points={axes.map((axis, i) => {
            const raw: number | null = model.metrics[axis.key];
            let value: number;
            if (raw === null) {
              // Handled by the `complete` filter; defensive fallback keeps the
              // polygon geometry valid without misrepresenting missing data.
              value = 0;
            } else if (axis.invert) {
              value = Math.min(1, 1 - (raw / axis.max));
            } else {
              value = Math.min(1, raw / axis.max);
            }
            value = Math.max(0, Math.min(1, value));
            const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
            const radius = value * 150;
            return `${200 + radius * Math.cos(angle)},${200 + radius * Math.sin(angle)}`;
          }).join(" ")}
          fill={`url(#radar-gradient-${modelIndex % colors.length})`}
          stroke={colors[modelIndex % colors.length]}
          strokeWidth={2}
          opacity={0.7}
        />
      ))}
      <g transform="translate(20, 20)">
        {complete.map((model, i) => (
          <g key={model.modelId} transform={`translate(0, ${i * 22})`}>
            <rect x={0} y={0} width={12} height={12} fill={colors[i % colors.length]} opacity={0.7} rx={2} />
            <text x={18} y={10} fontSize="11" fill="rgba(255,255,255,0.8)" fontFamily="system-ui">
              {model.modelName}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}