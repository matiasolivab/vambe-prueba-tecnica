"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyClientsPoint } from "@/analytics/application/temporal-metrics";
import { formatYearMonthEs } from "@/shared/date/format-month-es";

const COLOR_CLOSED = "#fbbf24";
const COLOR_OPEN = "#22d3ee";

export interface ClientsByMonthChartProps {
  readonly data: readonly MonthlyClientsPoint[];
}

export function ClientsByMonthChart({ data }: ClientsByMonthChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para graficar los últimos 12 meses.
      </p>
    );
  }

  return (
    <section
      role="region"
      aria-label="Clientes cerrados vs abiertos en los últimos 12 meses"
      className="h-60 w-full"
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={[...data]}
          margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            opacity={0.1}
          />
          <XAxis
            dataKey="yearMonth"
            tickFormatter={formatYearMonthEs}
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "currentColor", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
          />
          <Tooltip
            labelFormatter={(label) =>
              typeof label === "string" ? formatYearMonthEs(label) : ""
            }
            formatter={(value, name) => [
              `${String(value)} cliente(s)`,
              name === "closed" ? "Cerrados" : "Abiertos",
            ]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--popover-foreground)",
              fontSize: "0.8125rem",
            }}
          />
          <Legend
            verticalAlign="top"
            iconType="circle"
            formatter={(value) =>
              value === "closed" ? "Cerrados" : "Abiertos"
            }
          />
          <Line
            type="monotone"
            dataKey="closed"
            stroke={COLOR_CLOSED}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="open"
            stroke={COLOR_OPEN}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
