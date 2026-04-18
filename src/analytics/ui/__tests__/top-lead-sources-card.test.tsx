import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LeadSourceCount } from "@/analytics/application/metrics-calculator";

import { TopLeadSourcesCard } from "@/analytics/ui/top-lead-sources-card";

const threeItems: readonly LeadSourceCount[] = [
  { leadSource: "Recomendación", count: 45 },
  { leadSource: "Búsqueda Online", count: 30 },
  { leadSource: "Publicidad", count: 12 },
];

const oneItem: readonly LeadSourceCount[] = [
  { leadSource: "Recomendación", count: 45 },
];

describe("TopLeadSourcesCard", () => {
  it("renders the card title", () => {
    render(<TopLeadSourcesCard data={threeItems} />);
    expect(screen.getByText(/cómo nos encontraron/i)).toBeInTheDocument();
  });

  it("renders every lead source name and count when given multiple items", () => {
    render(<TopLeadSourcesCard data={threeItems} />);
    expect(screen.getByText("Recomendación")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("Búsqueda Online")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Publicidad")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders only real items when fewer than 5 are provided, no N/A padding", () => {
    render(<TopLeadSourcesCard data={oneItem} />);
    expect(screen.getByText("Recomendación")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  it("renders a fallback message when data is empty", () => {
    render(<TopLeadSourcesCard data={[]} />);
    expect(screen.getByText(/sin datos de captación/i)).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });
});
