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

import type { IndustryCount } from "@/analytics/application/metrics-calculator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COLOR_TOP = "#fbbf24"; // amber-400 — líder
const COLOR_REST = "#22d3ee"; // cyan-400 — resto
const COLOR_GRID = "#27272a";
const COLOR_AXIS_TICK = "#d4d4d8";
const COLOR_AXIS_LINE = "#3f3f46";
const COLOR_LABEL = "#a1a1aa";

const DISPLAY_NAME: Record<string, string> = {
  "Hogar/Sostenibilidad": "Hogar/Sost.",
  "Servicios Financieros": "Serv. Financieros",
  "Servicios Profesionales": "Serv. Profesionales",
};

function toDisplayName(v: string): string {
  return DISPLAY_NAME[v] ?? v;
}

interface Props {
  data: readonly IndustryCount[];
}

export function TopIndustriesCard({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          ¿Qué industrias se interesan más por nosotros?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Clientes por industria.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin datos de industrias
          </p>
        ) : (
          <IndustriesBarChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function IndustriesBarChart({ data }: { data: readonly IndustryCount[] }) {
  const enhanced = data.map((d) => ({
    ...d,
    displayName: toDisplayName(d.industry),
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={enhanced}
        margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
        barCategoryGap="25%"
      >
        <CartesianGrid
          stroke={COLOR_GRID}
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="displayName"
          tick={{ fill: COLOR_AXIS_TICK, fontSize: 12 }}
          stroke={COLOR_AXIS_LINE}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fill: COLOR_AXIS_TICK, fontSize: 12 }}
          stroke={COLOR_AXIS_LINE}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            fontSize: "0.8125rem",
          }}
          labelFormatter={(label: string) => {
            const match = enhanced.find((e) => e.displayName === label);
            return match?.industry ?? label;
          }}
          formatter={(value: number) => [value, "Clientes"]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index === 0 ? COLOR_TOP : COLOR_REST}
              fillOpacity={index === 0 ? 1 : 0.85}
            />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            fill={COLOR_LABEL}
            fontSize={11}
            className="tabular-nums"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
