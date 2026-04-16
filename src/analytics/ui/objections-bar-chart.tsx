"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DimensionRate } from "@/analytics/application/metrics-calculator";

export interface ObjectionsBarChartProps {
  readonly data: readonly DimensionRate[];
  readonly fill: string;
  readonly valueKey?: "total" | "closed";
}

interface ChartDatum {
  readonly value: string;
  readonly total: number;
  readonly closed: number;
}

/**
 * Horizontal bar chart of objection frequency (§8.4). Suppresses the
 * "Ninguna" pseudo-objection at the UI layer — the service returns it
 * because it's a legitimate categorical value, but it's not informative
 * for a "top objections" ranking.
 */
export function ObjectionsBarChart({
  data,
  fill,
  valueKey = "total",
}: ObjectionsBarChartProps) {
  const chartData = toChartData(data);

  if (chartData.length === 0) {
    return <EmptyState />;
  }

  return (
    <section
      role="region"
      aria-label="Objeciones por frecuencia"
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
        >
          <CartesianGrid stroke="#3f3f46" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#d4d4d8", fontSize: 11 }}
            stroke="#52525b"
          />
          <YAxis
            type="category"
            dataKey="value"
            width={140}
            tick={{ fill: "#d4d4d8", fontSize: 12 }}
            stroke="#52525b"
          />
          <Tooltip
            cursor={{ fill: "rgba(248,113,113,0.08)" }}
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
              if (!p) return ["—", "Menciones"];
              return [`${p.total} (cerrados: ${p.closed})`, "Menciones"];
            }}
          />
          <Bar dataKey={valueKey} fill={fill} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function toChartData(data: readonly DimensionRate[]): ChartDatum[] {
  return data
    .filter((r) => r.value !== "Ninguna")
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ value: r.value, total: r.total, closed: r.closed }));
}

function EmptyState() {
  return (
    <div className="flex h-72 w-full items-center justify-center">
      <p className="text-zinc-500 text-sm">Sin datos</p>
    </div>
  );
}
