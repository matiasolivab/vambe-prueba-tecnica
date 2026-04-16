import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ObjectionsBarChart } from "@/analytics/ui/objections-bar-chart";

describe("ObjectionsBarChart", () => {
  it("filters out the 'Ninguna' row from the displayed list", () => {
    render(
      <ObjectionsBarChart
        data={[
          { value: "Ninguna", total: 20, closed: 18, closeRate: 0.9 },
          { value: "Precio", total: 5, closed: 0, closeRate: 0 },
          { value: "Timing", total: 3, closed: 1, closeRate: 0.33 },
        ]}
        fill="#f87171"
      />,
    );
    expect(screen.queryByText(/Ninguna/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /objeciones/i })).toBeInTheDocument();
  });

  it("renders empty-state when only 'Ninguna' is in data", () => {
    render(
      <ObjectionsBarChart
        data={[
          { value: "Ninguna", total: 20, closed: 18, closeRate: 0.9 },
        ]}
        fill="#f87171"
      />,
    );
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });

  it("renders empty-state when data is empty", () => {
    render(<ObjectionsBarChart data={[]} fill="#f87171" />);
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });
});
