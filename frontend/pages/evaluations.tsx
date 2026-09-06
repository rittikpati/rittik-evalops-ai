"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DashboardLayout, PageContainer } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, type Column } from "@/components/ui/Table";
import { Search, Eye, Loader2, BarChart2, Target, CheckCircle, Cpu, Play, AlertCircle } from "@/components/layout/Icons";
import { MetricCard } from "@/components/charts/ChartComponents";
import { formatNumber, formatPercent, formatRelativeTime, formatCurrency } from "@/frontend/lib/utils";
import { getModelById } from "@/lib/ai/models";
import type { EvaluationRun } from "@/lib/evaluations/types";

type Row = { run: EvaluationRun; result: EvaluationRun["results"][number] };

export default function EvaluationsPage() {
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    fetch("/api/evaluations")
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && Array.isArray(j.runs)) {
          setRuns(j.runs as EvaluationRun[]);
        } else {
          setRuns([]);
        }
      })
      .catch(() => {
        setRuns([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return runs.flatMap((run) =>
      run.results.map((result) => ({ run, result }))
    );
  }, [runs]);

  const modelNames = useMemo(() => Array.from(new Set(rows.map((r) => r.result.model))), [rows]);

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.result.status === "success");
    const accVals = ok
      .map((r) => r.result.scores?.accuracy)
      .filter((v): v is number => v !== undefined && v !== null);
    return {
      results: rows.length,
      successful: ok.length,
      successRate: rows.length ? ok.length / rows.length : undefined,
      models: modelNames.length,
      runs: runs.length,
      cost: rows.reduce((s, r) => s + (r.result.estimatedCost ?? 0), 0),
      avgAccuracy: accVals.length ? accVals.reduce((s, v) => s + v, 0) / accVals.length : undefined,
    };
  }, [rows, runs, modelNames]);

  const filtered = rows.filter((row) => {
    const inSearch = row.result.input.toLowerCase().includes(search.toLowerCase()) || row.result.output.toLowerCase().includes(search.toLowerCase());
    const inModel = modelFilter === "all" || row.result.model === modelFilter;
    return inSearch && inModel;
  });

  const columns: Column<Row>[] = [
    { key: "input", header: "Question", width: "320px", render: (_, row) => <p className="font-medium text-foreground line-clamp-2 max-w-xs">{row.result.input}</p> },
    { key: "model", header: "Model", render: (_, row) => <Badge variant="brand" size="sm">{getModelById(row.result.model)?.displayName || row.result.model}</Badge> },
    { key: "status", header: "Status", render: (_, row) => (
      <Badge variant={row.result.status === "success" ? "success" : "danger"} size="sm">{row.result.status === "success" ? "OK" : "Error"}</Badge>
    )},
    { key: "accuracy", header: "Accuracy", render: (_, row) => <span className="font-mono font-semibold">{row.result.scores?.accuracy !== null && row.result.scores?.accuracy !== undefined ? formatPercent(row.result.scores.accuracy) : "â€”"}</span> },
    { key: "hallucination", header: "Hallucination", render: (_, row) => {
      const h = row.result.scores?.hallucination;
      if (h === undefined || h === null) return <span className="text-stone-500">â€”</span>;
      return <Badge variant={h >= 0.85 ? "success" : h >= 0.7 ? "warning" : "danger"}>{formatPercent(h)}</Badge>;
    }},
    { key: "latency", header: "Latency", render: (_, row) => <span className="font-mono text-stone-300">{row.result.status === "success" ? `${(row.result.latency / 1000).toFixed(2)}s` : "â€”"}</span> },
    { key: "cost", header: "Cost", render: (_, row) => <span className="font-mono text-stone-300">{row.result.estimatedCost != null ? formatCurrency(row.result.estimatedCost) : "â€”"}</span> },
    { key: "run", header: "Run", render: (_, row) => <span className="font-mono text-xs text-stone-500">{row.run.id.slice(0, 16)}</span> },
    { key: "createdAt", header: "Date", render: (_, row) => formatRelativeTime(row.run.completedAt || row.run.createdAt) },
    { key: "actions", header: "", render: (_, row) => (
      <Link href={`/runs/${row.run.id}`}><Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>View</Button></Link>
    )},
  ];

  return (
    <DashboardLayout>
      <PageContainer title="Evaluations" description="Per-case evaluation results across all runs">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input placeholder="Search questions or answers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="input h-10 w-auto bg-white/[0.04] border-[#2A2A28] text-sm px-3"
          >
            <option value="all">All Models</option>
            {modelNames.map((id) => <option key={id} value={id}>{getModelById(id)?.displayName || id}</option>)}
          </select>
        </div>
        {!loading && !error && stats.results > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <MetricCard label="Results" value={formatNumber(stats.results)} icon={<BarChart2 className="h-4 w-4" />} />
            <MetricCard label="Success Rate" value={stats.successRate !== undefined ? formatPercent(stats.successRate) : "â€”"} icon={<CheckCircle className="h-4 w-4" />} />
            <MetricCard label="Avg Accuracy" value={stats.avgAccuracy !== undefined ? formatPercent(stats.avgAccuracy) : "â€”"} icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Models" value={formatNumber(stats.models)} icon={<Cpu className="h-4 w-4" />} />
            <MetricCard label="Runs" value={formatNumber(stats.runs)} icon={<Play className="h-4 w-4" />} />
            <MetricCard label="Total Cost" value={formatCurrency(stats.cost)} icon={<BarChart2 className="h-4 w-4" />} />
          </div>
        )}

        {loading ? (
          <Card className="p-12 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#C8A96E]" />
            <p className="text-sm text-stone-400">Loading evaluationsâ€¦</p>
          </Card>
        ) : error ? (
          <Card className="p-12 text-center space-y-4">
            <AlertCircle className="h-8 w-8 mx-auto text-danger-400" />
            <p className="font-medium text-foreground">Failed to load evaluations</p>
            <p className="text-sm text-stone-400">The evaluation service did not respond. Check the server and retry.</p>
            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={load}>Retry</Button>
            </div>
          </Card>
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(r) => `${r.run.id}-${r.result.model}-${r.result.testCaseId}`} hoverable loading={false}
            emptyMessage="No evaluations yet. Run an experiment to generate results."
          />
        )}
      </PageContainer>
    </DashboardLayout>
  );
}