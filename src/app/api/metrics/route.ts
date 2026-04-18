import { NextResponse, type NextRequest } from "next/server";

import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import { createTemporalMetrics } from "@/analytics/application/temporal-metrics";
import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "@/shared/filters/parse-filters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const all = parseFiltersFromSearchParams(request.nextUrl.searchParams);
    const filters = metricFiltersOf(all);
    const calc = createMetricsCalculator();
    const temporal = createTemporalMetrics();
    const [
      kpis,
      sellers,
      sellerByIndustry,
      clientsByMonth,
      clientCountMoM,
      topSellerByMonth,
    ] = await Promise.all([
      calc.kpis(filters),
      calc.sellerRanking(filters),
      calc.sellerByIndustry(filters),
      temporal.clientsByMonth(filters),
      temporal.clientCountMoM(filters),
      temporal.topSellerByMonth(filters),
    ]);

    return NextResponse.json({
      kpis,
      sellers,
      sellerByIndustry,
      clientsByMonth,
      clientCountMoM,
      topSellerByMonth,
    });
  } catch (err) {
    console.error("[GET /api/metrics] error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
