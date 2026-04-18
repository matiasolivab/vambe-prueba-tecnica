import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CompanySizeCount } from "@/analytics/application/metrics-calculator";

// Mirror the Recharts mock pattern from clients-by-month-chart.test.tsx.
// ResponsiveContainer measures layout via ResizeObserver which is not
// available in JSDOM — replace it with a passthrough that forces fixed dims.
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  const ResponsiveContainer = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement | null => {
    if (!isValidElement(children)) return null;
    return cloneElement(
      children as React.ReactElement<{ width?: number; height?: number }>,
      { width: 500, height: 220 },
    );
  };
  return { ...actual, ResponsiveContainer };
});

import { CompanySizeBarChart } from "@/analytics/ui/company-size-bar-chart";

const sampleData: readonly CompanySizeCount[] = [
  { companySize: "PYME", count: 30 },
  { companySize: "Mid-market", count: 20 },
  { companySize: "Enterprise", count: 10 },
  { companySize: "Startup", count: 5 },
];

describe("CompanySizeBarChart", () => {
  it("renders an SVG chart when data is provided", () => {
    render(<CompanySizeBarChart data={sampleData} />);
    expect(document.querySelector("svg")).not.toBeNull();
  });

  it("maps PYME raw key to PyME display name", () => {
    render(<CompanySizeBarChart data={sampleData} />);
    // Recharts YAxis renders the display name as text ticks (may appear multiple times)
    const pymeElements = screen.getAllByText("PyME");
    expect(pymeElements.length).toBeGreaterThan(0);
    // Raw "PYME" should NOT appear as a text node
    expect(screen.queryByText("PYME")).not.toBeInTheDocument();
  });

  it("passes through labels that have no display override", () => {
    render(<CompanySizeBarChart data={sampleData} />);
    expect(screen.getAllByText("Mid-market").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Startup").length).toBeGreaterThan(0);
  });

  it("renders empty state when data is []", () => {
    render(<CompanySizeBarChart data={[]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
  });
});
