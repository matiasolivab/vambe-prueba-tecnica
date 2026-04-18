import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IndustryCount } from "@/analytics/application/metrics-calculator";
import { TopIndustriesCard } from "@/analytics/ui/top-industries-card";

const twoItems: readonly IndustryCount[] = [
  { industry: "Tecnología", count: 25 },
  { industry: "Salud", count: 12 },
];

const oneItem: readonly IndustryCount[] = [{ industry: "Tecnología", count: 25 }];

describe("TopIndustriesCard", () => {
  it("renders card title", () => {
    render(<TopIndustriesCard data={twoItems} />);
    expect(screen.getByText("Industrias principales")).toBeInTheDocument();
  });

  it("renders Principal and Secundaria labels with correct industry names and counts", () => {
    render(<TopIndustriesCard data={twoItems} />);

    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Tecnología")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();

    expect(screen.getByText("Secundaria")).toBeInTheDocument();
    expect(screen.getByText("Salud")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows N/A for Secundaria when only 1 item provided", () => {
    render(<TopIndustriesCard data={oneItem} />);

    // Principal is present
    expect(screen.getByText("Tecnología")).toBeInTheDocument();

    // Secundaria falls back
    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThan(0);
  });

  it("shows N/A for both rows when data is []", () => {
    render(<TopIndustriesCard data={[]} />);

    const naElements = screen.getAllByText("N/A");
    // Both Principal and Secundaria should show N/A
    expect(naElements.length).toBeGreaterThanOrEqual(2);
  });
});
