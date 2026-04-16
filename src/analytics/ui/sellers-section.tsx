import {
  createMetricsCalculator,
  type MetricFilters,
} from "@/analytics/application/metrics-calculator";
import { SellersBarChart } from "@/analytics/ui/sellers-bar-chart";
import { SellersIndustryTable } from "@/analytics/ui/sellers-industry-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * §8.2 — Performance de vendedores. Server Component: issues two parallel
 * reads against Neon, then hands plain JSON to the Client chart while the
 * crosstab table renders inline (no `"use client"` needed).
 *
 * Accepts global {@link MetricFilters} (RF3.2) — when present, every
 * aggregation is scoped to the filtered subset.
 */
export async function SellersSection({
  filters,
}: {
  readonly filters?: MetricFilters;
} = {}) {
  const calc = createMetricsCalculator();
  const [ranking, byIndustry] = await Promise.all([
    calc.sellerRanking(filters),
    calc.sellerByIndustry(filters),
  ]);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 text-lg">
          Performance de vendedores
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Ranking por tasa de cierre y cobertura por industria.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SellersBarChart data={ranking} />
        <SellersIndustryTable data={byIndustry} />
      </CardContent>
    </Card>
  );
}
