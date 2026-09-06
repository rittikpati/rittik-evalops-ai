"use client";

import { Calendar } from "@/components/layout/Icons";

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export const DEFAULT_RANGE: AnalyticsRange = "30d";

interface Props {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}

export function AnalyticsRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-stone-400" />
      <select
        aria-label="Analytics date range"
        value={value}
        onChange={(e) => onChange(e.target.value as AnalyticsRange)}
        className="h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]"
      >
        {(Object.keys(RANGE_LABELS) as AnalyticsRange[]).map((key) => (
          <option key={key} value={key} className="bg-[#1A1A1E] text-[#F5F1EB]">
            {RANGE_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );
}