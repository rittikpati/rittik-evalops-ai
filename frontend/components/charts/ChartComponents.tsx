"use client";

import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ComposedChart,
} from "recharts";
import { Card } from "@/components/ui/Card";
import type { TooltipContentProps, LegendPayload } from "recharts";

const COLORS = {
  brand: ["#1c1917", "#44403c", "#78716c"],
  accent: ["#9a3412", "#c2410c", "#ea580c"],
  success: ["#15803d", "#16a34a", "#4ade80"],
  danger: ["#b91c1c", "#dc2626", "#f87171"],
  models: {
    "GPT-4o": "#1c1917",
    "Claude 3.5 Sonnet": "#9a3412",
    "Llama 3.1 405B": "#78716c",
    "Qwen 2.5 72B": "#a67c52",
    "GPT-4o Mini": "#57534e",
    "Claude 3 Haiku": "#d6d3d1",
  },
  gradient: {
    brand: "url(#gradient-brand)",
    accent: "url(#gradient-accent)",
    success: "url(#gradient-success)",
    danger: "url(#gradient-danger)",
  },
};

const customTooltip = ({ active, payload, label }: TooltipContentProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <motion.div
      className="glass-strong border border-stone-200 rounded-xl p-3 shadow-glass-strong"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <p className="text-xs text-stone-500 font-mono mb-2">{label}</p>
      {payload.map((entry, index) => (
        <motion.div
          key={index}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? "#78716c" }} />
          <span className="text-sm font-medium text-stone-900">{entry.name}</span>
          <span className="text-sm text-stone-600 font-mono">{typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "")}</span>
        </motion.div>
      ))}
    </motion.div>
  );
};

const customLegend = ({ payload }: { payload?: readonly LegendPayload[] }) => (
  <div className="flex flex-wrap gap-4 justify-center mt-4">
    {payload?.map((entry, index) => (
      <motion.div
        key={entry.value ?? index}
        className="flex items-center gap-2 text-sm text-stone-600"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="h-2 w-6 rounded" style={{ background: `linear-gradient(90deg, ${entry.color ?? "#78716c"}CC, ${entry.color ?? "#78716c"})` }} />
        <span>{entry.value}</span>
      </motion.div>
    ))}
  </div>
);

interface BarChartProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKeys: string[];
  title?: string;
  subtitle?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  animate?: boolean;
}

export function BarChartComponent({
  data,
  xKey,
  yKeys,
  title,
  subtitle,
  colors = Object.values(COLORS.models),
  height = 300,
  showLegend = true,
  animate = true,
}: BarChartProps) {
  return (
    <Card className="h-full">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="h-[300px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <defs>
              {yKeys.map((key, index) => (
                <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis
              type="number"
              tick={{ fill: "#78716c", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              dataKey={xKey}
              type="category"
              width={100}
              tick={{ fill: "#44403c", fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={customTooltip} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} content={customLegend} />}
            {yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`url(#gradient-${key})`}
                radius={[0, 4, 4, 0]}
                maxBarSize={32}
                isAnimationActive={animate}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((_, i) => (
                  <Cell key={`cell-${key}-${i}`} fill={`url(#gradient-${key})`} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface LineChartProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKeys: string[];
  title?: string;
  subtitle?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  animate?: boolean;
  fillArea?: boolean;
}

export function LineChartComponent({
  data,
  xKey,
  yKeys,
  title,
  subtitle,
  colors = Object.values(COLORS.models),
  height = 300,
  showLegend = true,
  animate = true,
  fillArea = false,
}: LineChartProps) {
  return (
    <Card className="h-full">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="h-[300px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {fillArea ? (
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                {yKeys.map((key, index) => (
                  <linearGradient key={key} id={`gradient-area-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#78716c", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tick={{ fill: "#78716c", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={customTooltip} />
              {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} content={customLegend} />}
              {yKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  fill={`url(#gradient-area-${key})`}
                  isAnimationActive={animate}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#78716c", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tick={{ fill: "#78716c", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={customTooltip} />
              {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} content={customLegend} />}
              {yKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  isAnimationActive={animate}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface ScatterChartProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKey: string;
  zKey?: string;
  labelKey?: string;
  title?: string;
  subtitle?: string;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  animate?: boolean;
}

export function ScatterChartComponent({
  data,
  xKey,
  yKey,
  zKey,
  labelKey,
  title,
  subtitle,
  height = 300,
  xLabel,
  yLabel,
  animate = true,
}: ScatterChartProps) {
  return (
    <Card className="h-full">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="h-[300px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart data={data} margin={{ top: 10, right: 30, left: 60, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              type="number"
              dataKey={xKey}
              name={xLabel}
              
              tick={{ fill: "#78716c", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              name={yLabel}
              
              tick={{ fill: "#78716c", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ paddingTop: 20 }} content={customLegend} />
            <Scatter
              name="Models"
              data={data}
              fill="#1c1917"
              stroke="#44403c"
              strokeWidth={2}
              isAnimationActive={animate}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={COLORS.models[entry[labelKey || "model"] as keyof typeof COLORS.models] || COLORS.brand[0]}
                  stroke={COLORS.models[entry[labelKey || "model"] as keyof typeof COLORS.models] || COLORS.brand[0]}
                  r={zKey ? Math.max(6, Math.min(24, (Number(entry[zKey]) / 10) * 6)) : 8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface ComposedChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  barKeys: string[];
  lineKeys: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  animate?: boolean;
}

export function ComposedChartComponent({
  data,
  xKey,
  barKeys,
  lineKeys,
  title,
  subtitle,
  height = 300,
  animate = true,
}: ComposedChartProps) {
  const allKeys = [...barKeys, ...lineKeys];
  const colors = Object.values(COLORS.models);

  return (
    <Card className="h-full">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="h-[300px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <defs>
              {barKeys.map((key, index) => (
                <linearGradient key={key} id={`gradient-composed-${key}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis
              dataKey={xKey}
              type="category"
              width={100}
              tick={{ fill: "#44403c", fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#78716c", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ paddingTop: 20 }} content={customLegend} />
            {barKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`url(#gradient-composed-${key})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={animate}
                animationDuration={800}
              />
            ))}
            {lineKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[(barKeys.length + index) % colors.length]}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={1000}
                yAxisId="right"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface MetricCardProps {
  value: string | number;
  label: string;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function MetricCard({ value, label, change, changeLabel, trend = "neutral", icon, className = "" }: MetricCardProps) {
  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-emerald-400" />,
    down: <TrendingDown className="h-4 w-4 text-red-400" />,
    neutral: <Minus className="h-4 w-4 text-stone-500" />,
  };

  return (
    <motion.div
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      className={className}
    >
      <Card variant="elevated" className="h-full group">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs tracking-wide font-medium text-stone-500 uppercase">{label}</p>
            <motion.p
              className="mt-2 text-[28px] font-bold tracking-tight text-[#F5F1EB] tabular-nums leading-none"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {value}
            </motion.p>
            {change !== undefined && (
              <div className="mt-3 flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${trend === "up" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : trend === "down" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/[0.06] border-[#2A2A28] text-stone-400"}`}>
                  {trendIcons[trend]}
                  {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                </span>
                {changeLabel && <span className="text-xs text-stone-500">{changeLabel}</span>}
              </div>
            )}
          </div>
          {icon && <div className="h-10 w-10 rounded-xl bg-[#0F0F0F] border border-[#2A2A28] flex items-center justify-center text-stone-400 group-hover:text-[#C8A96E] group-hover:border-[#C8A96E]/20 transition-colors">{icon}</div>}
        </div>
      </Card>
    </motion.div>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = "#C8A96E", height = 40, width = 120 }: SparklineProps) {
  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - (value / Math.max(...data)) * (height - 4) + 2,
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.9} />
        </linearGradient>
      </defs>
      <path
        d={path}
        stroke="url(#sparkline-gradient)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
}