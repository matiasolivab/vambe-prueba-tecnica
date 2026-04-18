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

  it("renders all 3 lead source names and their counts when given 3 items", () => {
    render(<TopLeadSourcesCard data={threeItems} />);
    expect(screen.getByText("Recomendación")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("Búsqueda Online")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Publicidad")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders N/A fallbacks for slots 2 and 3 when given 1 item", () => {
    render(<TopLeadSourcesCard data={oneItem} />);
    expect(screen.getByText("Recomendación")).toBeInTheDocument();
    const naItems = screen.getAllByText("N/A");
    expect(naItems.length).toBeGreaterThanOrEqual(2);
  });

  it("renders all three slots as N/A when given empty data", () => {
    render(<TopLeadSourcesCard data={[]} />);
    const naItems = screen.getAllByText("N/A");
    expect(naItems.length).toBeGreaterThanOrEqual(3);
  });
});
