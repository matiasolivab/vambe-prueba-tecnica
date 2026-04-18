import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SellerConversion } from "@/analytics/application/metrics-calculator";

// Recharts measures layout off ResponsiveContainer; in JSDOM that yields a
// 0x0 chart which never renders axes, bars, or legend. Swap it for a
// passthrough that forces `width` + `height` onto the chart child.
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  const ResponsiveContainer = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement | null => {
    if (!isValidElement(children)) return null;
    return cloneElement(
      children as React.ReactElement<{ width?: number; height?: number }>,
      { width: 500, height: 320 },
    );
  };
  return { ...actual, ResponsiveContainer };
});

import {
  CustomTooltip,
  SellersConversionBarChart,
} from "@/analytics/ui/sellers-conversion-bar-chart";

const sampleData: readonly SellerConversion[] = [
  {
    seller: "Toro",
    totalClients: 10,
    closedClients: 5,
    openClients: 5,
    closeRate: 0.5,
  },
  {
    seller: "Puma",
    totalClients: 8,
    closedClients: 2,
    openClients: 6,
    closeRate: 0.25,
  },
  {
    seller: "Lobo",
    totalClients: 4,
    closedClients: 4,
    openClients: 0,
    closeRate: 1,
  },
];

describe("SellersConversionBarChart", () => {
  it("renders one row per seller with the accessible region label", () => {
    render(<SellersConversionBarChart data={sampleData} />);
    expect(
      screen.getByRole("region", { name: /conversión por vendedor/i }),
    ).toBeInTheDocument();
    // YAxis renders seller names as tick labels. Recharts also emits a
    // hidden `recharts_measurement_span` with the text, so at least one
    // match is required per seller.
    expect(screen.getAllByText("Toro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Puma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lobo").length).toBeGreaterThan(0);
  });

  it("custom tooltip renders seller, totals, and close rate lines", () => {
    const row: SellerConversion = {
      seller: "Ana",
      totalClients: 10,
      closedClients: 4,
      openClients: 6,
      closeRate: 0.4,
    };
    render(
      <CustomTooltip
        active
        payload={[
          {
            value: row.closedClients,
            name: "closedClients",
            dataKey: "closedClients",
            payload: row,
          },
        ]}
        label={row.seller}
      />,
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/10 reuniones · 4 cerradas/)).toBeInTheDocument();
    expect(screen.getByText(/40% close rate/)).toBeInTheDocument();
  });

  it("custom tooltip returns null when inactive", () => {
    const { container } = render(
      <CustomTooltip active={false} payload={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
