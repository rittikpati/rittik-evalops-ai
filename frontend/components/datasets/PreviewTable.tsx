"use client";

import { useMemo, useState } from "react";
import { X, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { EditableCase } from "./types";
import type { TabularMapping } from "@/lib/datasets/import";

interface PreviewTableProps {
  cases: EditableCase[];
  onChange: (cases: EditableCase[]) => void;
  columns?: string[];
  mapping?: TabularMapping | null;
  onMappingChange?: (mapping: { input?: string; expectedOutput?: string; context?: string }) => void;
}

const NEEDS_REVIEW_THRESHOLD = 0.6;

export function needsReview(c: EditableCase): boolean {
  return !c.input.trim() || Boolean(c.issue) || (c.confidence ?? 1) < NEEDS_REVIEW_THRESHOLD;
}

export function PreviewTable({ cases, onChange, columns = [], mapping, onMappingChange }: PreviewTableProps) {
  const [filter, setFilter] = useState<"all" | "review">("all");

  const reviewCount = useMemo(() => cases.filter(needsReview).length, [cases]);
  const visible = useMemo(() => {
    if (filter === "all") return cases.map((c, i) => ({ c, i }));
    return cases.map((c, i) => ({ c, i })).filter(({ c }) => needsReview(c));
  }, [cases, filter]);

  const update = (key: string, patch: Partial<EditableCase>) => {
    onChange(cases.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };
  const remove = (key: string) => onChange(cases.filter((c) => c.key !== key));
  const moveRow = (index: number, delta: -1 | 1) => {
    const next = [...cases];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
  };

  const showMapping = onMappingChange && columns.length > 0;

  return (
    <div>
      {showMapping && mapping && (
        <div className="mb-4 rounded-xl border border-[#2A2A28] bg-[#1A1A1E] p-4">
          <p className="text-sm font-medium text-[#F5F1EB] mb-3">Column mapping — {mapping.lowConfidence ? "needs your help" : "auto-detected"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["input", "Question / input"],
                ["expectedOutput", "Expected answer (optional)"],
                ["context", "Context (optional)"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-xs text-stone-400">{label}</span>
                <select
                  className="mt-1 w-full rounded-xl bg-[#0F0F0F] border border-[#2A2A28] px-3 py-2 text-sm text-[#F5F1EB] focus:outline-none focus:border-[#C8A96E]"
                  value={mapping[field] ?? ""}
                  onChange={(e) => {
                    if (!onMappingChange) return;
                    const value = e.target.value || undefined;
                    const next: { input?: string; expectedOutput?: string; context?: string } = {};
                    if (field === "input") next.input = value;
                    if (field === "expectedOutput") next.expectedOutput = value;
                    if (field === "context") next.context = value;
                    onMappingChange(next);
                  }}
                >
                  <option value="">— could not map —</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col || "(empty header)"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">Changes take effect immediately and re-extract the rows below.</p>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Badge variant="success" size="sm">{cases.length - reviewCount} valid</Badge>
        {reviewCount > 0 && <Badge variant="warning" size="sm">{reviewCount} need review</Badge>}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>
            All
          </Button>
          <Button size="sm" variant={filter === "review" ? "secondary" : "ghost"} onClick={() => setFilter("review")} disabled={reviewCount === 0}>
            Needs review
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2A2A28]">
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#161618]">
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500">
                <th className="px-3 py-2 w-10"></th>
                <th className="px-2 py-2 w-[34%]">Question / input</th>
                <th className="px-2 py-2 w-[30%]">Expected answer</th>
                <th className="px-2 py-2 hidden md:table-cell w-[26%]">Context</th>
                <th className="px-2 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ c, i }) => (
                <tr key={c.key}>
                  <td className="px-3 py-1.5 align-top">
                    <div className="flex flex-col items-center gap-0.5">
                      <button className="text-stone-600 hover:text-stone-300" onClick={() => moveRow(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button className="text-stone-600 hover:text-stone-300" onClick={() => moveRow(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Input className="py-1.5 text-sm" value={c.input} placeholder="Question" onChange={(e) => update(c.key, { input: e.target.value, issue: e.target.value.trim() ? c.issue : "Missing question." })} />
                    {Boolean(c.issue) && (c.confidence ?? 1) >= NEEDS_REVIEW_THRESHOLD && (
                      <p className="mt-1 text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {c.issue}</p>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top"><Input className="py-1.5 text-sm" value={c.expectedOutput} placeholder="Expected (optional)" onChange={(e) => update(c.key, { expectedOutput: e.target.value })} /></td>
                  <td className="px-2 py-1.5 align-top hidden md:table-cell"><Input className="py-1.5 text-sm" value={c.context} placeholder="Context (optional)" onChange={(e) => update(c.key, { context: e.target.value })} /></td>
                  <td className="px-2 py-1.5 align-top">
                    <button className="text-stone-500 hover:text-red-400" onClick={() => remove(c.key)} aria-label="Remove row"><X className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                    No rows{filter === "review" ? " needing review" : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}