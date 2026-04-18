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
    expect(valueEl.classList.contains("text-cyan-600")).toBe(true);
  });

  it("applies amber highlight to the value when highlight='amber'", () => {
    render(<KpiTile label="Best Seller" value="Ana" highlight="amber" />);
    const valueEl = screen.getByText("Ana");
    expect(valueEl.classList.contains("text-amber-600")).toBe(true);
  });

  describe("delta prop", () => {
    it("renders an up delta with emerald tone and an '↑' arrow", () => {
      render(
        <KpiTile
          label="Total"
          value={50}
          delta={{ pct: 12.5, direction: "up" }}
        />,
      );
      const badge = screen.getByText(/12\.5%/);
      expect(badge.textContent).toContain("↑");
      expect(badge.className).toMatch(/text-emerald-400/);
      expect(badge.className).toMatch(/bg-emerald-500\/10/);
    });

    it("renders a down delta with rose tone, '↓' arrow, and absolute value", () => {
      render(
        <KpiTile
          label="Total"
          value={30}
          delta={{ pct: -40, direction: "down" }}
        />,
      );
      const badge = screen.getByText(/40\.0%/);
      expect(badge.textContent).toContain("↓");
      expect(badge.textContent).not.toContain("-");
      expect(badge.className).toMatch(/text-rose-400/);
      expect(badge.className).toMatch(/bg-rose-500\/10/);
    });

    it("renders a flat delta as literal '0%' with zinc tone and no arrow", () => {
      render(
        <KpiTile
          label="Total"
          value={0}
          delta={{ pct: 0, direction: "flat" }}
        />,
      );
      const badge = screen.getByText("0%");
      expect(badge.textContent).not.toContain("↑");
      expect(badge.textContent).not.toContain("↓");
      expect(badge.className).toMatch(/text-zinc-500/);
    });

    it("renders an N/A delta with zinc tone and no arrow", () => {
      render(
        <KpiTile
          label="Total"
          value={0}
          delta={{ pct: null, direction: "na" }}
        />,
      );
      const badge = screen.getByText("N/A");
      expect(badge.textContent).not.toContain("↑");
      expect(badge.textContent).not.toContain("↓");
      expect(badge.className).toMatch(/text-zinc-500/);
    });

    it("omits the delta badge entirely when delta prop is absent", () => {
      render(<KpiTile label="Total" value={42} />);
      expect(screen.queryByText(/%/)).toBeNull();
      expect(screen.queryByText("N/A")).toBeNull();
    });

    it("formats delta pct with exactly one decimal (12.53 → '12.5%')", () => {
      render(
        <KpiTile
          label="Total"
          value={50}
          delta={{ pct: 12.53, direction: "up" }}
        />,
      );
      expect(screen.getByText(/12\.5%/)).toBeInTheDocument();
      expect(screen.queryByText(/12\.53%/)).toBeNull();
    });
  });
});
