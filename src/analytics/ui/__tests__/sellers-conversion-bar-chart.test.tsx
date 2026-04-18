import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SellerConversion } from "@/analytics/application/metrics-calculator";
import { SellersConversionBarChart } from "@/analytics/ui/sellers-conversion-bar-chart";

const sampleData: readonly SellerConversion[] = [
  {
    seller: "Juan Pérez",
    totalClients: 30,
    closedClients: 9,
    openClients: 21,
    closeRate: 0.3,
  },
  {
    seller: "Ana López",
    totalClients: 15,
    closedClients: 0,
    openClients: 15,
    closeRate: 0,
  },
  {
    seller: "María Soto",
    totalClients: 18,
    closedClients: 18,
    openClients: 0,
    closeRate: 1,
  },
];

function getRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="seller-row"]'),
  );
}

describe("SellersConversionBarChart", () => {
  it("renders one row per seller preserving the prop order", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("Juan Pérez")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Ana López")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("María Soto")).toBeInTheDocument();
  });

  it("renders totalClients as a plain number, without unit labels", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    expect(within(rows[0]!).getByText("30")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("15")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("18")).toBeInTheDocument();
    rows.forEach((row) => {
      expect(row.textContent ?? "").not.toMatch(/reuniones/i);
    });
  });

  it("exposes a native title tooltip with the exact format", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    expect(rows[0]!.getAttribute("title")).toBe(
      "Juan Pérez · 30 reuniones · 9 cerradas · 21 abiertas · 30% close rate",
    );
    expect(rows[1]!.getAttribute("title")).toBe(
      "Ana López · 15 reuniones · 0 cerradas · 15 abiertas · 0% close rate",
    );
    expect(rows[2]!.getAttribute("title")).toBe(
      "María Soto · 18 reuniones · 18 cerradas · 0 abiertas · 100% close rate",
    );
  });

  it("scales the outer bar proportionally to the max totalClients", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    const outers = rows.map(
      (row) =>
        row.querySelector<HTMLElement>('[data-testid="seller-bar-outer"]')!,
    );
    // Max is Juan (30) → 100%. Ana (15) → 50%. María (18) → 60%.
    expect(outers[0]!.style.width).toBe("100%");
    expect(outers[1]!.style.width).toBe("50%");
    expect(outers[2]!.style.width).toBe("60%");
  });

  it("splits amber/cyan inside the outer bar by closeRate", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    const juanAmber = rows[0]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-closed"]',
    )!;
    const juanCyan = rows[0]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-open"]',
    )!;
    expect(juanAmber.style.width).toBe("30%");
    expect(juanAmber.className).toContain("bg-amber-400");
    expect(juanCyan.className).toContain("bg-cyan-400");
    expect(juanCyan.className).toContain("flex-1");
  });

  it("collapses the amber segment when closeRate is 0", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    const anaAmber = rows[1]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-closed"]',
    )!;
    const anaCyan = rows[1]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-open"]',
    )!;
    expect(anaAmber.style.width).toBe("0%");
    expect(anaCyan).toBeInTheDocument();
    expect(anaCyan.className).toContain("bg-cyan-400");
  });

  it("fills the amber segment when closeRate is 1", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    const rows = getRows();
    const mariaAmber = rows[2]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-closed"]',
    )!;
    const mariaCyan = rows[2]!.querySelector<HTMLElement>(
      '[data-testid="seller-bar-open"]',
    )!;
    expect(mariaAmber.style.width).toBe("100%");
    expect(mariaCyan).toBeInTheDocument();
  });

  it("renders the empty-state message when data is []", () => {
    render(<SellersConversionBarChart data={[]} />);
    const empty = screen.getByText(/sin vendedores con reuniones/i);
    expect(empty).toBeInTheDocument();
    expect(empty.className).toContain("text-zinc-500");
    expect(getRows()).toHaveLength(0);
    expect(document.querySelector("svg")).toBeNull();
  });
});
