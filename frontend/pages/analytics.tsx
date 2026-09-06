"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout, PageContainer, Section, Grid } from "@/components/layout/DashboardLayout";
import { MetricCard, LineChartComponent } from "@/components/charts/ChartComponents";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  FlaskConical,
  Activity,
  Cpu,
  Target,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
  Loader2,
  AlertTriangle,
  BarChart2,
  TrendingUp,
} from "@/components/layout/Icons";
import { getModelById } from "@/lib/ai/models";
import { aggregateRun, aggregateComparison } from "@/lib/ai/runAggregation";
import type { EvaluationRun } from "@/lib/evaluations/types";
import { formatNumber, formatCurrency, formatPercent, formatDate } from "@/frontend/lib/utils";
import { AnalyticsRangeFilter, DEFAULT_RANGE, RANGE_LABELS, type AnalyticsRange } from "@/components/analytics/AnalyticsRangeFilter";

const RANGE_DAYS: Record<Exclude<AnalyticsRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const JUDGE_KEYS = ["accuracy", "faithfulness", "relevance", "hallucination", "completeness", "toxicity", "bias", "safety"] as const;

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<EvaluationRun[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE);
  const [now, setNow] = useState(() => Date.now());

  const handleRangeChange = (next: AnalyticsRange) => {
    setRange(next);
    setNow(Date.now());
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/evaluations");
        const j = (await res.json()) as { status?: string; runs?: EvaluationRun[]; error?: string };
        if (cancelled) return;
        if (res.ok && j.status === "success" && Array.isArray(j.runs)) {
          setRuns(j.runs);
        } else {
          setLoadError(j.error || "Failed to load runs.");
        }
      } catch {
        if (!cancelled) setLoadError("Could not reach the server. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter runs by the selected date range (real createdAt timestamps).
  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    if (range === "all") return runs;
    const days = RANGE_DAYS[range];
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return runs.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
  }, [runs, range, now]);

  // Trend points: one per run across the selected window. Runs with no scored
  // execution leave a metric as null (a gap), never a fabricated 0.
  const trendPoints = useMemo(
    () =>
      filteredRuns.map((run) => {
        const p = aggregateRun(run.results);
        return {
          date: formatDate(run.createdAt, { month: "short", day: "numeric" }),
          id: run.id,
          accuracy: p.accuracy,
          successRate: p.total > 0 ? p.successRate : null,
          latency: p.avgLatency !== null ? p.avgLatency / 1000 : null,
          cost: p.totalCost,
          tokens: p.totalTokens,
          total: p.total,
          successful: p.successful,
        };
      }),
    [filteredRuns]
  );

  // Aggregate cards across the selected window (pooled from real executions).
  const cards = useMemo(() => {
    const allResults = filteredRuns.flatMap((r) => r.results);
    const runsSummary = filteredRuns.map((r) => aggregateRun(r.results));
    const accuracies = runsSummary.map((p) => p.accuracy).filter((v): v is number => v !== null && Number.isFinite(v));
    const latencies = allResults.filter((r) => r.status === "success" && typeof r.latency === "number").map((r) => r.latency as number);
    const successfulExecs = allResults.filter((r) => r.status === "success").length;
    return {
      experiments: new Set(filteredRuns.map((r) => r.experimentId)).size,
      runs: filteredRuns.length,
      models: new Set(allResults.map((r) => r.model).filter(Boolean)).size,
      avgAccuracy: accuracies.length ? accuracies.reduce((s, v) => s + v, 0) / accuracies.length : null,
      successRate: allResults.length ? successfulExecs / allResults.length : null,
      avgLatency: latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null,
      totalCost: allResults.reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
      totalTokens: allResults.reduce((s, r) => s + r.totalTokens, 0),
      modelsTested: allResults.filter((r) => r.status === "success").length,
    };
  }, [filteredRuns]);

  // Model performance comparison across the window (per-model judge averages,
  // failed executions and missing metrics excluded).
  const modelRows = useMemo(
    () => aggregateComparison(filteredRuns.flatMap((r) => r.results)),
    [filteredRuns]
  );

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <Card className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading analyticsâ€¦</p>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <PageContainer>
          <Card className="p-12 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-400" />
            <p className="font-medium text-foreground">Failed to load analytics</p>
            <p className="text-sm text-stone-400">{loadError}</p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </Card>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const noData = filteredRuns.length === 0;

  return (
    <DashboardLayout>
      <PageContainer
        title="Analytics"
        description={`Trends and metrics from your real evaluation runs (${RANGE_LABELS[range]})`}
        action={<AnalyticsRangeFilter value={range} onChange={handleRangeChange} />}
      >
        {noData ? (
          <Card className="p-12 text-center space-y-2">
            <BarChart2 className="h-8 w-8 mx-auto text-stone-600" />
            <p className="font-medium text-foreground">No run data in this range</p>
            <p className="text-sm text-stone-400">Run an experiment to populate analytics, or widen the date range.</p>
            <div className="pt-2">
              <Link href="/experiments/new"><Button variant="primary" size="sm">New Experiment</Button></Link>
            </div>
          </Card>
        ) : (
          <>
            <Section title="Overview" description={`Derived from ${formatNumber(cards.runs)} persisted run${cards.runs === 1 ? "" : "s"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard value={formatNumber(cards.experiments)} label="Experiments" icon={<FlaskConical className="h-6 w-6" />} />
                <MetricCard value={formatNumber(cards.runs)} label="Runs" icon={<Activity className="h-6 w-6" />} />
                <MetricCard value={formatNumber(cards.models)} label="Models Compared" icon={<Cpu className="h-6 w-6" />} />
                <MetricCard
                  value={cards.avgAccuracy === null ? "N/A" : formatPercent(cards.avgAccuracy)}
                  label="Avg Accuracy"
                  icon={<Target className="h-6 w-6" />}
                />
                <MetricCard
                  value={cards.successRate === null ? "N/A" : formatPercent(cards.successRate)}
                  label="Success Rate"
                  icon={<CheckCircle className="h-6 w-6" />}
                />
                <MetricCard
                  value={cards.avgLatency === null ? "N/A" : `${(cards.avgLatency / 1000).toFixed(2)}s`}
                  label="Avg Latency"
                  icon={<Clock className="h-6 w-6" />}
                />
                <MetricCard value={formatCurrency(cards.totalCost)} label="Total Cost" icon={<DollarSign className="h-6 w-6" />} />
                <MetricCard value={formatNumber(cards.totalTokens)} label="Token Usage" icon={<Zap className="h-6 w-6" />} />
              </div>
            </Section>

            <Grid columns={2} gap={6}>
              <Section title="Accuracy Trend" description="Average judge accuracy per run over time (scored runs only)">
                <LineChartComponent
                  data={trendPoints}
                  xKey="date"
                  yKeys={["accuracy"]}
                  colors={["#C8A96E"]}
                  height={300}
                  showLegend={false}
                />
              </Section>
              <Section title="Success Rate Trend" description="Proportion of successful executions per run">
                <LineChartComponent
                  data={trendPoints}
                  xKey="date"
                  yKeys={["successRate"]}
                  colors={["#16a34a"]}
                  height={300}
                  showLegend={false}
                  fillArea
                />
              </Section>
            </Grid>

            <Grid columns={2} gap={6}>
              <Section title="Average Latency" description="Mean response latency per run (successful executions only, seconds)">
                <LineChartComponent
                  data={trendPoints}
                  xKey="date"
                  yKeys={["latency"]}
                  colors={["#ea580c"]}
                  height={300}
                  showLegend={false}
                  fillArea
                />
              </Section>
              <Section title="Token Usage" description="Total tokens consumed per run">
                <LineChartComponent
                  data={trendPoints}
                  xKey="date"
                  yKeys={["tokens"]}
                  colors={["#8b5cf6"]}
                  height={300}
                  showLegend={false}
                  fillArea
                />
              </Section>
            </Grid>

            <Section title="Model Performance Comparison" description="Average judge scores per model across this range â€” higher is better for all dimensions">
              {modelRows.length === 0 ? (
                <Card className="p-8 text-center text-sm text-stone-500">
                  No models produced scored executions in this range.
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {modelRows.map((m) => (
                    <Card key={m.modelId} variant="elevated" className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-xs font-bold text-[#F5F1EB]">
                          {(getModelById(m.modelId)?.displayName || m.modelId).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{getModelById(m.modelId)?.displayName || m.modelId}</p>
                          <p className="text-xs text-stone-400">{getModelById(m.modelId)?.provider || "â€”"} Â· {m.successful}/{m.total} successful</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1 text-sm">
                          <TrendingUp className="h-4 w-4 text-[#C8A96E]" />
                          <span className="font-mono font-semibold">{m.accuracy !== null ? formatPercent(m.accuracy) : "N/A"}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {JUDGE_KEYS.map((key) => {
                          const v = m[key];
                          if (v === null || v === undefined) {
                            return (
                              <div key={key} className="flex items-center justify-between text-xs">
                                <span className="capitalize text-stone-400">{key}</span>
                                <span className="text-stone-500">N/A</span>
                              </div>
                            );
                          }
                          return (
                            <div key={key} className="flex items-center justify-between gap-3 text-xs">
                              <span className="capitalize text-stone-400 w-24">{key}</span>
                              <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#C8A96E] to-[#B89A5F] rounded-full"
                                  style={{ width: `${Math.max(0, Math.min(100, v * 100))}%` }}
                                />
                              </div>
                              <span className="font-mono tabular-nums text-stone-300 w-12 text-right">{formatPercent(v)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                        <Badge variant="neutral" size="sm">Cost {formatCurrency(m.totalCost)}</Badge>
                        <Badge variant="neutral" size="sm">{formatNumber(m.totalTokens)} tokens</Badge>
                        <Badge variant="success" size="sm">{formatPercent(m.successRate)} success</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}