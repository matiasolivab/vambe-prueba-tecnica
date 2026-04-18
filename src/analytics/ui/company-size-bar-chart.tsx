"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CompanySizeCount } from "@/analytics/application/metrics-calculator";

const DISPLAY: Record<string, string> = { PYME: "PyME" };

function displayName(v: string): string {
  return DISPLAY[v] ?? v;
}

interface Props {
  data: readonly CompanySizeCount[];
}

export function CompanySizeBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center">
        <p className="text-sm text-zinc-500">Sin datos</p>
      </div>
    );
  }

  const sorted = [...data]
    .sort(
      (a, b) =>
        b.count - a.count || a.companySize.localeCompare(b.companySize),
    )
    .map((d) => ({ ...d, displayName: displayName(d.companySize) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart layout="vertical" data={sorted}>
        <XAxis
          type="number"
          tick={{ fill: "#d4d4d8", fontSize: 12 }}
          stroke="#3f3f46"
        />
        <YAxis
          type="category"
          dataKey="displayName"
          width={110}
          tick={{ fill: "#d4d4d8", fontSize: 12 }}
          stroke="#3f3f46"
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            fontSize: "0.8125rem",
          }}
        />
        <Bar dataKey="count" fill="#22d3ee" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
