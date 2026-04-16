import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiTile } from "@/analytics/ui/kpi-tile";

describe("KpiTile", () => {
  it("renders label and numeric value", () => {
    render(<KpiTile label="Total" value={42} />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the value with tabular-nums class for aligned digits", () => {
    render(<KpiTile label="Count" value={1234} />);
    const valueEl = screen.getByText("1234");
    expect(valueEl.classList.contains("tabular-nums")).toBe(true);
  });

  it("renders caption when provided", () => {
    render(<KpiTile label="Seller" value="Ana" caption="Close rate 75%" />);
    expect(screen.getByText("Close rate 75%")).toBeInTheDocument();
  });

  it("omits caption node when caption prop is absent", () => {
    render(<KpiTile label="Seller" value="Ana" />);
    expect(screen.queryByText(/Close rate/)).not.toBeInTheDocument();
  });

  it("applies cyan highlight to the value when highlight='cyan'", () => {
    render(<KpiTile label="Close Rate" value="75%" highlight="cyan" />);
    const valueEl = screen.getByText("75%");
    expect(valueEl.classList.contains("text-cyan-400")).toBe(true);
  });

  it("applies amber highlight to the value when highlight='amber'", () => {
    render(<KpiTile label="Best Seller" value="Ana" highlight="amber" />);
    const valueEl = screen.getByText("Ana");
    expect(valueEl.classList.contains("text-amber-400")).toBe(true);
  });
});
