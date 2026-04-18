import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { IndustryCount } from "@/analytics/application/metrics-calculator";

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
      { width: 800, height: 320 },
    );
  };
  return { ...actual, ResponsiveContainer };
});

import { TopIndustriesCard } from "@/analytics/ui/top-industries-card";

const sampleData: readonly IndustryCount[] = [
  { industry: "Tecnología", count: 25 },
  { industry: "Salud", count: 12 },
  { industry: "Educación", count: 8 },
  { industry: "Logística", count: 4 },
];

describe("TopIndustriesCard", () => {
  it("renders the card title as a short question", () => {
    render(<TopIndustriesCard data={sampleData} />);
    expect(
      screen.getByText(/¿qué industrias se interesan más por nosotros\?/i),
    ).toBeInTheDocument();
  });

  it("renders an SVG bar chart with all industry names on the X axis", () => {
    render(<TopIndustriesCard data={sampleData} />);
    expect(document.querySelector("svg")).not.toBeNull();
    for (const { industry } of sampleData) {
      expect(screen.getAllByText(industry).length).toBeGreaterThan(0);
    }
  });

  it("renders the empty state when data is []", () => {
    render(<TopIndustriesCard data={[]} />);
    expect(screen.getByText(/sin datos de industrias/i)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
  });
});
