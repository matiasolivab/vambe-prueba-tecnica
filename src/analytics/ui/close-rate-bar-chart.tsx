"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DimensionRate } from "@/analytics/application/metrics-calculator";

const CYAN = "#22d3ee"; // cyan-400
const AMBER = "#fbbf24"; // amber-400 — top bar highlight

export interface CloseRateBarChartProps {
  readonly title: string;
  readonly data: readonly DimensionRate[];
}

interface ChartDatum {
  readonly value: string;
  readonly closeRatePct: number;
  readonly total: number;
  readonly closed: number;
}

/**
 * Single-dimension close-rate bar chart (§8.3). The same shape is reused
 * six times — industry, company size, decision-maker role, sentiment,
 * buying signal, purchase timeline.
 */
export function CloseRateBarChart({ title, data }: CloseRateBarChartProps) {
  const chartData = toChartData(data);
  const isEmpty = chartData.length === 0;

  return (
    <section
      role="region"
      aria-label={title}
      className="flex flex-col rounded-lg bg-zinc-900 ring-1 ring-zinc-800 p-4"
    >
      <h3 className="text-zinc-300 text-sm font-medium mb-2">{title}</h3>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
            >
              <CartesianGrid stroke="#3f3f46" vertical={false} />
              <XAxis
                dataKey="value"
                angle={-30}
                textAnchor="end"
                interval={0}
                height={48}
                tick={{ fill: "#d4d4d8", fontSize: 11 }}
                stroke="#52525b"
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "#d4d4d8", fontSize: 11 }}
                stroke="#52525b"
              />
              <Tooltip
                cursor={{ fill: "rgba(34,211,238,0.08)" }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  color: "#e4e4e7",
                }}
                formatter={(
                  _value: unknown,
                  _name: unknown,
                  ctx: { payload?: ChartDatum },
                ) => {
                  const p = ctx.payload;
                  if (!p) return ["—", "Tasa de cierre"];
                  return [
                    `${p.closeRatePct}% (${p.closed}/${p.total})`,
                    "Tasa de cierre",
                  ];
                }}
              />
              <Bar dataKey="closeRatePct" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.value} fill={index === 0 ? AMBER : CYAN} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function toChartData(data: readonly DimensionRate[]): ChartDatum[] {
  return data
    .slice()
    .sort((a, b) => b.closeRate - a.closeRate)
    .map((r) => ({
      value: r.value,
      closeRatePct: Math.round(r.closeRate * 100),
      total: r.total,
      closed: r.closed,
    }));
}

function EmptyState() {
  return (
    <div className="flex h-56 w-full items-center justify-center">
      <p className="text-zinc-500 text-sm">Sin datos</p>
    </div>
  );
}
