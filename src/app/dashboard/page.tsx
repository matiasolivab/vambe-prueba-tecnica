import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import type { KpiMetrics } from "@/analytics/application/metrics-calculator";
import {
  createTemporalMetrics,
  type ClientCountMoM,
  type TopSellerByMonth,
} from "@/analytics/application/temporal-metrics";
import { ClientsByMonthChart } from "@/analytics/ui/clients-by-month-chart";
import { CompanySizeBarChart } from "@/analytics/ui/company-size-bar-chart";
import { KpiTile } from "@/analytics/ui/kpi-tile";
import { PainPointsMatrix } from "@/analytics/ui/pain-points-matrix";
import { SellersConversionBarChart } from "@/analytics/ui/sellers-conversion-bar-chart";
import { TopIndustriesCard } from "@/analytics/ui/top-industries-card";
import { TopLeadSourcesCard } from "@/analytics/ui/top-lead-sources-card";
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

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { metricFilters } = await resolveDashboardFilters(searchParams);
  const calc = createMetricsCalculator();
  const temporal = createTemporalMetrics();
  const conversionFilters = { ...metricFilters, closed: undefined };
  const [kpis, sellers, countMoM, topSeller, series, conversion,
         painCounts, sizeCounts, topInd, topLeadSources] =
    await Promise.all([
      calc.kpis(metricFilters),
      getDashboardSellers(),
      temporal.clientCountMoM(metricFilters),
      temporal.topSellerByMonth(metricFilters),
      temporal.clientsByMonth(metricFilters),
      calc.sellerConversion(conversionFilters),
      calc.painPointCounts(metricFilters),
      calc.companySizeDistribution(metricFilters),
      calc.topIndustries(metricFilters, 100),
      calc.topLeadSources(metricFilters),
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
          label="¿Cuántos clientes tenemos?"
          value={countMoM.current}
          caption={view.totalCaption}
          delta={view.totalDelta}
        />
        <KpiTile
          label="¿Quién vende más este mes?"
          value={view.topSellerValue}
          caption={view.topSellerCaption}
          highlight="amber"
        />
        <KpiTile
          label="¿Cuál es el dolor principal?"
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
              ¿Cómo evoluciona el pipeline?
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
                  ¿Qué vendedor cierra mejor?
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

      <section
        aria-label="Pains y tamaño de empresa"
        className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <PainPointsMatrix data={painCounts} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              ¿A qué tamaño de empresa vendemos?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <CompanySizeBarChart data={sizeCounts} />
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="Captación e industrias"
        className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <TopLeadSourcesCard data={topLeadSources} />
        <TopIndustriesCard data={topInd} />
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
