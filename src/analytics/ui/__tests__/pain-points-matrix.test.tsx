import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PainPointCount } from "@/analytics/application/metrics-calculator";
import { PainPointsMatrix } from "@/analytics/ui/pain-points-matrix";

const sampleData: readonly PainPointCount[] = [
  { painPoint: "Volumen Repetitivo", count: 42 },
  { painPoint: "Equipo Saturado", count: 18 },
  { painPoint: "Respuestas Lentas", count: 10 },
  { painPoint: "Costos", count: 5 },
];

describe("PainPointsMatrix", () => {
  it("renders one cell per pain point with count and label", () => {
    render(<PainPointsMatrix data={sampleData} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Volumen Repetitivo")).toBeInTheDocument();

    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Equipo Saturado")).toBeInTheDocument();

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Respuestas Lentas")).toBeInTheDocument();

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Costos")).toBeInTheDocument();
  });

  it("highlights the top item with amber class and the rest with cyan", () => {
    render(<PainPointsMatrix data={sampleData} />);

    const topCount = screen.getByText("42");
    expect(topCount.className).toContain("text-amber-400");

    const secondCount = screen.getByText("18");
    expect(secondCount.className).toContain("text-cyan-400");
  });

  it("renders the empty-state message when data is []", () => {
    render(<PainPointsMatrix data={[]} />);
    expect(
      screen.getByText("Sin datos de pain points"),
    ).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });
});
