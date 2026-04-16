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

import type { SellerRanking } from "@/analytics/application/metrics-calculator";

const CYAN = "#22d3ee"; // cyan-400 — primary
const AMBER = "#fbbf24"; // amber-400 — top performer

export interface SellersBarChartProps {
  readonly data: readonly SellerRanking[];
}

interface ChartDatum {
  readonly name: string;
  readonly closeRatePct: number;
  readonly total: number;
  readonly closed: number;
}

/**
 * Bar chart of sellers ranked by close rate (§8.2).
 *
 * Data prep is minimal: trust the service, cap at top 10 (defensive), then
 * pre-project the close rate to percent so Recharts reads a flat number.
 */
export function SellersBarChart({ data }: SellersBarChartProps) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  const chartData = toChartData(data);

  return (
    <section
      role="region"
      aria-label="Ranking de vendedores por tasa de cierre"
      className="h-80 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#3f3f46" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#d4d4d8", fontSize: 12 }} stroke="#52525b" />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: "#d4d4d8", fontSize: 12 }}
            stroke="#52525b"
          />
          <Tooltip
            cursor={{ fill: "rgba(34,211,238,0.08)" }}
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              color: "#e4e4e7",
            }}
            formatter={(value: unknown, _name: unknown, ctx: { payload?: ChartDatum }) => {
              const payload = ctx.payload;
              if (!payload) return [`${String(value)}%`, "Tasa de cierre"];
              return [
                `${payload.closeRatePct}% (${payload.closed}/${payload.total})`,
                "Tasa de cierre",
              ];
            }}
          />
          <Bar dataKey="closeRatePct" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={index === 0 ? AMBER : CYAN} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function toChartData(data: readonly SellerRanking[]): ChartDatum[] {
  return data
    .slice()
    .sort((a, b) => b.closeRate - a.closeRate)
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
      closeRatePct: Math.round(r.closeRate * 100),
      total: r.totalClients,
      closed: r.closedCount,
    }));
}

function EmptyState() {
  return (
    <div className="flex h-80 w-full items-center justify-center">
      <p className="text-zinc-500 text-sm">Sin datos</p>
    </div>
  );
}
