import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MonthlyClientsPoint } from "@/analytics/application/temporal-metrics";

// Recharts measures layout off ResponsiveContainer; in JSDOM that yields a
// 0x0 SVG which never renders axes or lines. Swap it for a fixed-size wrapper
// so every <Line>, <Legend> and <XAxis tick> actually lands in the DOM.
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 320 }}>{children}</div>
    ),
  };
});

import { ClientsByMonthChart } from "@/analytics/ui/clients-by-month-chart";

describe("ClientsByMonthChart", () => {
  it("renders an empty-state message when the series is empty", () => {
    render(<ClientsByMonthChart data={[]} />);
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
    // No SVG lines when empty.
    expect(document.querySelector("svg")).toBeNull();
  });

  it("renders both series (Cerrados + Abiertos) when data is present", () => {
    const data: MonthlyClientsPoint[] = buildTwelveMonthSeries("2026-04", [
      { yearMonth: "2026-04", closed: 5, open: 3 },
      { yearMonth: "2026-03", closed: 2, open: 4 },
    ]);
    render(<ClientsByMonthChart data={data} />);

    expect(screen.getByText("Cerrados")).toBeInTheDocument();
    expect(screen.getByText("Abiertos")).toBeInTheDocument();
  });

  it("formats X-axis ticks using the Spanish month abbreviation", () => {
    const data: MonthlyClientsPoint[] = buildTwelveMonthSeries("2026-04", [
      { yearMonth: "2026-04", closed: 5, open: 3 },
    ]);
    render(<ClientsByMonthChart data={data} />);
    // The tick formatter should output e.g. "Abr '26" for the last bucket.
    expect(screen.getByText("Abr '26")).toBeInTheDocument();
  });
});

function buildTwelveMonthSeries(
  anchor: string,
  overrides: readonly MonthlyClientsPoint[],
): MonthlyClientsPoint[] {
  const override = new Map(overrides.map((o) => [o.yearMonth, o]));
  const months: string[] = [];
  let cursor = anchor;
  for (let i = 0; i < 12; i++) {
    months.push(cursor);
    cursor = previousYearMonth(cursor);
  }
  months.reverse();
  return months.map(
    (ym) => override.get(ym) ?? { yearMonth: ym, closed: 0, open: 0 },
  );
}

function previousYearMonth(yyyyMM: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMM);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}
