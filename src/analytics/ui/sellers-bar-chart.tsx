"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SellerRanking } from "@/analytics/application/metrics-calculator";

const TOKEN = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  border: "var(--border)",
  mutedFg: "var(--muted-foreground)",
  popover: "var(--popover)",
  popoverFg: "var(--popover-foreground)",
};

export interface SellersBarChartProps {
  readonly data: readonly SellerRanking[];
}

interface ChartDatum {
  readonly name: string;
  readonly closeRatePct: number;
  readonly total: number;
  readonly closed: number;
}

export function SellersBarChart({ data }: SellersBarChartProps) {
  if (data.length === 0) return <EmptyState />;

  const chartData = toChartData(data);

  return (
    <section
      role="region"
      aria-label="Ranking de vendedores por tasa de cierre"
      className="h-80 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 28, right: 12, left: 0, bottom: 8 }}
        >
          <defs>
            <linearGradient id="sellers-primary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKEN.primary} stopOpacity={0.95} />
              <stop offset="100%" stopColor={TOKEN.primary} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="sellers-accent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKEN.accent} stopOpacity={1} />
              <stop offset="100%" stopColor={TOKEN.accent} stopOpacity={0.7} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={TOKEN.border}
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: TOKEN.mutedFg, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: TOKEN.border }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: TOKEN.mutedFg, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--primary) 8%, transparent)" }}
            contentStyle={{
              backgroundColor: TOKEN.popover,
              border: `1px solid ${TOKEN.border}`,
              borderRadius: "0.5rem",
              color: TOKEN.popoverFg,
              boxShadow: "0 10px 40px -15px rgba(0,0,0,0.12)",
              fontSize: "0.8125rem",
            }}
            formatter={(
              value: unknown,
              _name: unknown,
              ctx: { payload?: ChartDatum },
            ) => {
              const p = ctx.payload;
              if (!p) return [`${String(value)}%`, "Tasa de cierre"];
              return [
                `${p.closeRatePct}% · ${p.closed}/${p.total}`,
                "Tasa de cierre",
              ];
            }}
          />
          <Bar dataKey="closeRatePct" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={
                  index === 0
                    ? "url(#sellers-accent)"
                    : "url(#sellers-primary)"
                }
              />
            ))}
            <LabelList dataKey="closeRatePct" content={TopChip} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function TopChip(props: {
  index?: number;
  x?: number | string;
  y?: number | string;
  width?: number | string;
}) {
  if (props.index !== 0) return null;
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const cx = x + width / 2;
  const cy = y - 12;
  const chipWidth = 36;
  const chipHeight = 18;
  return (
    <g transform={`translate(${cx - chipWidth / 2}, ${cy - chipHeight / 2})`}>
      <rect
        width={chipWidth}
        height={chipHeight}
        rx={9}
        fill="var(--accent)"
        fillOpacity={0.15}
        stroke="var(--accent)"
        strokeOpacity={0.45}
      />
      <text
        x={chipWidth / 2}
        y={chipHeight / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="var(--accent-foreground)"
        style={{ letterSpacing: "0.04em" }}
      >
        TOP
      </text>
    </g>
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
      <p className="text-sm text-muted-foreground">Sin datos</p>
    </div>
  );
}
