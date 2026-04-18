"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { SellerConversion } from "@/analytics/application/metrics-calculator";

/**
 * Stacked horizontal bar chart for Overview — one row per seller. Closed =
 * amber-400 (wins), open = cyan-400 (pipeline). The stack is declared with
 * `stackId="conv"`, so amber renders from the origin and cyan extends to the
 * right. Hex literals mirror `clients-by-month-chart.tsx` so both charts
 * share the exact same colour semantics.
 */

const COLOR_CLOSED = "#fbbf24"; // amber-400 — wins
const COLOR_OPEN = "#22d3ee"; // cyan-400 — pipeline

export interface SellersConversionBarChartProps {
  readonly data: readonly SellerConversion[];
}

export function SellersConversionBarChart({
  data,
}: SellersConversionBarChartProps) {
  return (
    <section
      role="region"
      aria-label="Conversión por vendedor: reuniones cerradas vs abiertas"
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          layout="vertical"
          data={[...data]}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.1}
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            tick={{ fill: "currentColor", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="seller"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "currentColor", fontSize: 12 }}
          />
          <Bar stackId="conv" dataKey="closedClients" fill={COLOR_CLOSED} />
          <Bar
            stackId="conv"
            dataKey="openClients"
            fill={COLOR_OPEN}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
