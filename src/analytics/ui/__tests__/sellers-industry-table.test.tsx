import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SellersIndustryTable } from "@/analytics/ui/sellers-industry-table";

const sampleData = [
  {
    seller: "Toro",
    industry: "Tecnología",
    total: 4,
    closed: 3,
    closeRate: 0.75,
  },
  {
    seller: "Toro",
    industry: "Retail",
    total: 2,
    closed: 1,
    closeRate: 0.5,
  },
  {
    seller: "Ana",
    industry: "Tecnología",
    total: 5,
    closed: 2,
    closeRate: 0.4,
  },
];

describe("SellersIndustryTable", () => {
  it("renders a column header per unique industry", () => {
    render(<SellersIndustryTable data={sampleData} />);
    expect(
      screen.getByRole("columnheader", { name: "Tecnología" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Retail" }),
    ).toBeInTheDocument();
  });

  it("renders a row header per unique seller", () => {
    render(<SellersIndustryTable data={sampleData} />);
    expect(
      screen.getByRole("rowheader", { name: "Ana" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Toro" }),
    ).toBeInTheDocument();
  });

  it("renders `${closed}/${total}` in the cell for (Toro, Tecnología)", () => {
    render(<SellersIndustryTable data={sampleData} />);
    const cell = screen.getByTestId("cell-Toro-Tecnología");
    expect(within(cell).getByText("3/4")).toBeInTheDocument();
  });

  it("highlights cells where close rate >= 0.75 with a primary ring", () => {
    render(<SellersIndustryTable data={sampleData} />);
    const hot = screen.getByTestId("cell-Toro-Tecnología");
    const cold = screen.getByTestId("cell-Ana-Tecnología");
    expect(hot.className).toMatch(/ring-primary/);
    expect(cold.className).not.toMatch(/ring-primary/);
  });
});
