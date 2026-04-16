import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import { CloseAnalysis } from "@/analytics/ui/close-analysis";
import { KpiTile } from "@/analytics/ui/kpi-tile";
import { ObjectionsSection } from "@/analytics/ui/objections-section";
import { SellersSection } from "@/analytics/ui/sellers-section";
import { FiltersBar } from "@/app/ui/filters-bar";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { ClientsSection } from "@/clients/ui/clients-section";
import UploadButton from "@/ingestion/ui/upload-button";
import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "@/shared/filters/parse-filters";

// KPIs must reflect live Neon data on every request — no ISR, no static cache.
export const dynamic = "force-dynamic";

/**
 * Next 16 passes `searchParams` as a Promise — awaiting it is mandatory
 * (see `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromSearchParams(sp);
  const metricFilters = metricFiltersOf(filters);

  const calc = createMetricsCalculator();
  const repo = createDrizzleClientRepository();

  const [kpis, sellers] = await Promise.all([
    calc.kpis(metricFilters),
    repo.distinctSellers(),
  ]);

  const closeRatePct = `${Math.round(kpis.closeRate * 100)}%`;
  const topSellerValue = kpis.topSeller?.name ?? "—";
  const topSellerCaption = kpis.topSeller
    ? `Tasa de cierre: ${Math.round(kpis.topSeller.closeRate * 100)}%`
    : undefined;
  const topPainPointValue = kpis.topPainPoint?.value ?? "—";
  const topPainPointCaption = kpis.topPainPoint
    ? `${kpis.topPainPoint.count} menciones`
    : undefined;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Vambe · Dashboard
            </h1>
            <p className="text-zinc-400 mt-2">
              Categorización automática de transcripciones de ventas
            </p>
          </div>
          <UploadButton />
        </header>

        <FiltersBar sellers={sellers} />

        <section
          aria-label="KPIs principales"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <KpiTile label="Total de clientes" value={kpis.totalClients} />
          <KpiTile
            label="Tasa de cierre global"
            value={closeRatePct}
            highlight="cyan"
          />
          <KpiTile
            label="Mejor vendedor"
            value={topSellerValue}
            caption={topSellerCaption}
            highlight="amber"
          />
          <KpiTile
            label="Pain point más común"
            value={topPainPointValue}
            caption={topPainPointCaption}
          />
        </section>

        <section className="mt-10">
          <SellersSection filters={metricFilters} />
        </section>
        <section className="mt-10">
          <CloseAnalysis filters={metricFilters} />
        </section>
        <section className="mt-10">
          <ObjectionsSection filters={metricFilters} />
        </section>
        <section className="mt-10">
          <ClientsSection filters={filters} />
        </section>
      </div>
    </main>
  );
}
