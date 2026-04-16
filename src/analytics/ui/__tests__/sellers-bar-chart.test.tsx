import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SellersBarChart } from "@/analytics/ui/sellers-bar-chart";

describe("SellersBarChart", () => {
  it("renders an empty-state message when data is empty", () => {
    render(<SellersBarChart data={[]} />);
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });

  it("renders a chart region with accessible label when data is present", () => {
    render(
      <SellersBarChart
        data={[
          { name: "Ana", totalClients: 10, closedCount: 8, closeRate: 0.8 },
          { name: "Luis", totalClients: 10, closedCount: 4, closeRate: 0.4 },
        ]}
      />,
    );
    expect(
      screen.getByRole("region", { name: /ranking de vendedores/i }),
    ).toBeInTheDocument();
  });
});
