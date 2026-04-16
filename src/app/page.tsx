import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import { KpiTile } from "@/analytics/ui/kpi-tile";

// KPIs must reflect live Neon data on every request — no ISR, no static cache.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const calc = createMetricsCalculator();
  const kpis = await calc.kpis();

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
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            Vambe · Dashboard
          </h1>
          <p className="text-zinc-400 mt-2">
            Categorización automática de transcripciones de ventas
          </p>
        </header>

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

        {/* Phase 7.3-7.5 will add further sections below */}
      </div>
    </main>
  );
}
