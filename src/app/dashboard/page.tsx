import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import type { KpiMetrics } from "@/analytics/application/metrics-calculator";
import {
  createTemporalMetrics,
  type ClientCountMoM,
  type TopSellerByMonth,
} from "@/analytics/application/temporal-metrics";
import { ClientsByMonthChart } from "@/analytics/ui/clients-by-month-chart";
import { KpiTile } from "@/analytics/ui/kpi-tile";
import { SellersConversionBarChart } from "@/analytics/ui/sellers-conversion-bar-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatYearMonthEs,
  previousYearMonth,
} from "@/shared/date/format-month-es";
import {
  resolveDashboardFilters,
  type DashboardSearchParams,
} from "@/shared/filters/resolve-dashboard-filters";

import { getDashboardSellers } from "./data";
import { SectionHeader } from "./ui/section-header";

// KPIs must reflect live Neon data on every request — no ISR, no static cache.
export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { metricFilters } = await resolveDashboardFilters(searchParams);
  const calc = createMetricsCalculator();
  const temporal = createTemporalMetrics();
  // The stacked bar chart splits closed vs open — applying filters.closed
  // would flatten one series. Strip it locally (same pattern as the 12-month
  // line chart above, which also ignores `closed`).
  const conversionFilters = { ...metricFilters, closed: undefined };
  const [kpis, sellers, countMoM, topSeller, series, conversion] =
    await Promise.all([
      calc.kpis(metricFilters),
      getDashboardSellers(),
      temporal.clientCountMoM(metricFilters),
      temporal.topSellerByMonth(metricFilters),
      temporal.clientsByMonth(metricFilters),
      calc.sellerConversion(conversionFilters),
    ]);
  const view = formatOverview({ kpis, countMoM, topSeller });

  return (
    <>
      <SectionHeader
        badge="Resumen ejecutivo"
        title="Overview"
        description="Los KPIs principales aplicando los filtros activos."
        sellers={sellers}
      />
      <section
        aria-label="KPIs principales"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <KpiTile
          label="Total de clientes"
          value={countMoM.current}
          caption={view.totalCaption}
          delta={view.totalDelta}
        />
        <KpiTile
          label="Mejor vendedor del mes"
          value={view.topSellerValue}
          caption={view.topSellerCaption}
          highlight="amber"
        />
        <KpiTile
          label="Pain point más común"
          value={view.topPainPointValue}
          caption={view.topPainPointCaption}
        />
      </section>
      <section
        aria-label="Tendencia y conversión"
        className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Clientes cerrados vs abiertos — últimos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClientsByMonthChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium">
                  Conversión por vendedor
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Volumen de reuniones y tasa de cierre de cada vendedor
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: "#fbbf24" }}
                  />
                  Cerradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: "#22d3ee" }}
                  />
                  Abiertas
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SellersConversionBarChart data={conversion} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

interface OverviewView {
  readonly totalCaption: string;
  readonly totalDelta: {
    readonly pct: number | null;
    readonly direction: "up" | "down" | "flat" | "na";
  };
  readonly topSellerValue: string;
  readonly topSellerCaption: string | undefined;
  readonly topPainPointValue: string;
  readonly topPainPointCaption: string | undefined;
}

function formatOverview(input: {
  kpis: KpiMetrics;
  countMoM: ClientCountMoM;
  topSeller: TopSellerByMonth | null;
}): OverviewView {
  const { kpis, countMoM, topSeller } = input;
  return {
    totalCaption: formatTotalCaption(countMoM),
    totalDelta: formatTotalDelta(countMoM),
    ...formatTopSeller(topSeller, countMoM),
    topPainPointValue: kpis.topPainPoint?.value ?? "—",
    topPainPointCaption: kpis.topPainPoint
      ? `${kpis.topPainPoint.count} menciones`
      : undefined,
  };
}

function formatTotalCaption(countMoM: ClientCountMoM): string {
  if (countMoM.referenceYearMonth === "") return "Sin datos";
  const now = formatYearMonthEs(countMoM.referenceYearMonth);
  const prev = formatYearMonthEs(previousYearMonth(countMoM.referenceYearMonth));
  return `${now} vs ${prev}`;
}

function formatTotalDelta(
  countMoM: ClientCountMoM,
): OverviewView["totalDelta"] {
  if (countMoM.referenceYearMonth === "") return { pct: null, direction: "na" };
  if (countMoM.deltaPct === null) return { pct: null, direction: "na" };
  if (countMoM.deltaPct > 0) {
    return { pct: countMoM.deltaPct, direction: "up" };
  }
  if (countMoM.deltaPct < 0) {
    return { pct: countMoM.deltaPct, direction: "down" };
  }
  return { pct: 0, direction: "flat" };
}

function formatTopSeller(
  topSeller: TopSellerByMonth | null,
  countMoM: ClientCountMoM,
): { topSellerValue: string; topSellerCaption: string | undefined } {
  if (topSeller) {
    const pct = Math.round(topSeller.closeRateInMonth * 100);
    const month = formatYearMonthEs(topSeller.yearMonth);
    return {
      topSellerValue: topSeller.name,
      topSellerCaption: `${topSeller.closedInMonth} cierres · ${pct}% · ${month}`,
    };
  }
  if (countMoM.referenceYearMonth === "") {
    return { topSellerValue: "—", topSellerCaption: "Sin datos" };
  }
  const month = formatYearMonthEs(countMoM.referenceYearMonth);
  return {
    topSellerValue: `Sin cierres en ${month}`,
    topSellerCaption: undefined,
  };
}
