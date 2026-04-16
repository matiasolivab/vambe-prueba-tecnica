import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CloseRateBarChart } from "@/analytics/ui/close-rate-bar-chart";

describe("CloseRateBarChart", () => {
  it("renders the provided title", () => {
    render(<CloseRateBarChart title="Industria" data={[]} />);
    expect(screen.getByText("Industria")).toBeInTheDocument();
  });

  it("renders empty-state when data is empty", () => {
    render(<CloseRateBarChart title="Industria" data={[]} />);
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });

  it("renders a chart region when data is present", () => {
    render(
      <CloseRateBarChart
        title="Tamaño"
        data={[
          { value: "Grande", total: 10, closed: 8, closeRate: 0.8 },
          { value: "Mediano", total: 6, closed: 2, closeRate: 0.33 },
        ]}
      />,
    );
    expect(
      screen.getByRole("region", { name: /tamaño/i }),
    ).toBeInTheDocument();
  });
});
