import {
  createMetricsCalculator,
  type MetricFilters,
} from "@/analytics/application/metrics-calculator";
import { CloseRateBarChart } from "@/analytics/ui/close-rate-bar-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * §8.3 — Análisis de cierre. Six close-rate breakdowns in a responsive
 * grid. All six queries run in parallel so the whole section shares a
 * single round-trip budget. Accepts global filters (RF3.2).
 */
export async function CloseAnalysis({
  filters,
}: {
  readonly filters?: MetricFilters;
} = {}) {
  const calc = createMetricsCalculator();
  const [byIndustry, byCompanySize, byRole, bySentiment, bySignal, byTimeline] =
    await Promise.all([
      calc.closeRateBy("industry", filters),
      calc.closeRateBy("companySize", filters),
      calc.closeRateBy("decisionMakerRole", filters),
      calc.closeRateBy("sentiment", filters),
      calc.closeRateBy("buyingSignal", filters),
      calc.closeRateBy("purchaseTimeline", filters),
    ]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 text-lg">
          Análisis de cierre
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Tasa de cierre por dimensión cualitativa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CloseRateBarChart title="Industria" data={byIndustry} />
          <CloseRateBarChart title="Tamaño" data={byCompanySize} />
          <CloseRateBarChart title="Rol decisor" data={byRole} />
          <CloseRateBarChart title="Sentiment" data={bySentiment} />
          <CloseRateBarChart title="Buying signal" data={bySignal} />
          <CloseRateBarChart title="Timeline" data={byTimeline} />
        </div>
      </CardContent>
    </Card>
  );
}
