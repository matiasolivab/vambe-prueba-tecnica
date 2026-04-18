import { NextResponse, type NextRequest } from "next/server";

import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import { createTemporalMetrics } from "@/analytics/application/temporal-metrics";
import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "@/shared/filters/parse-filters";

/**
 * GET /api/metrics — dashboard aggregates for the Overview, Sellers, and
 * Clients sections. Fired on page load and again whenever the global filter
 * strip changes (§RF3.2). Every aggregation runs in Postgres so this handler
 * stays thin: parse filters → `Promise.all` fan-out → one JSON blob.
 *
 * Payload shape:
 *  - `kpis`              → total clients + top pain point
 *  - `sellers`           → ranking by close rate (seller bar chart)
 *  - `sellerByIndustry`  → crosstab for the sellers × industries heatmap
 *  - `clientsByMonth`    → 12-month closed/open trend (line chart)
 *  - `clientCountMoM`    → MoM delta for the Total clients tile
 *  - `topSellerByMonth`  → best seller of the anchor month
 *
 * `search` is intentionally NOT part of `MetricFilters` (only table filtering
 * uses free text; metrics are categorical), so we strip it via
 * {@link metricFiltersOf} after parsing.
 */

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
