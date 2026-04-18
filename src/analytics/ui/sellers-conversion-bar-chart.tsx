"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
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
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Sin vendedores con reuniones en el período seleccionado.
      </p>
    );
  }

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
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "currentColor", opacity: 0.04 }}
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

/**
 * Tooltip contents — rendered by Recharts on bar hover and exported for
 * direct testing (bypasses JSDOM mouseMove flakiness on BarChart).
 * Format: seller / "{total} reuniones · {closed} cerradas" / "{pct}% close rate".
 */
export function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, string>): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as SellerConversion | undefined;
  if (!row) return null;
  const ratePct = Math.round(row.closeRate * 100);
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{
        background: "var(--popover)",
        borderColor: "var(--border)",
        color: "var(--popover-foreground)",
      }}
    >
      <div className="text-sm font-medium">{row.seller}</div>
      <div className="mt-0.5 text-muted-foreground">
        {row.totalClients} reuniones · {row.closedClients} cerradas
      </div>
      <div className="mt-0.5">{ratePct}% close rate</div>
    </div>
  );
}
