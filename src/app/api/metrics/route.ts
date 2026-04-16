import { NextResponse, type NextRequest } from "next/server";

import {
  createMetricsCalculator,
  type MetricFilters,
} from "@/analytics/application/metrics-calculator";

/**
 * GET /api/metrics — dashboard aggregates (PRD §8.1–8.4). Fired once on page
 * load and again whenever the global filter strip changes (§RF3.2). Every
 * aggregation runs in Postgres via {@link MetricsCalculator}, so this
 * handler stays thin: parse filters → `Promise.all` fan-out → one JSON blob.
 *
 * The response shape mirrors the dashboard layout — `kpis` for §8.1, `sellers`
 * + `sellerByIndustry` for §8.2, `closeRateBy` for §8.3, `objections` for §8.4.
 *
 * `search` is intentionally NOT part of `MetricFilters` (only table filtering
 * uses free text; metrics are categorical).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = parseMetricFilters(request.nextUrl.searchParams);
    const calc = createMetricsCalculator();
    const [
      kpis,
      sellers,
      industry,
      companySize,
      decisionMakerRole,
      sentiment,
      buyingSignal,
      purchaseTimeline,
      sellerByIndustry,
      objections,
    ] = await Promise.all([
      calc.kpis(filters),
      calc.sellerRanking(filters),
      calc.closeRateBy("industry", filters),
      calc.closeRateBy("companySize", filters),
      calc.closeRateBy("decisionMakerRole", filters),
      calc.closeRateBy("sentiment", filters),
      calc.closeRateBy("buyingSignal", filters),
      calc.closeRateBy("purchaseTimeline", filters),
      calc.sellerByIndustry(filters),
      calc.objections(filters),
    ]);

    return NextResponse.json({
      kpis,
      sellers,
      closeRateBy: {
        industry,
        companySize,
        decisionMakerRole,
        sentiment,
        buyingSignal,
        purchaseTimeline,
      },
      sellerByIndustry,
      objections,
    });
  } catch (err) {
    console.error("[GET /api/metrics] error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

function parseMetricFilters(sp: URLSearchParams): MetricFilters {
  const filters: Record<string, string | boolean> = {};
  for (const key of [
    "assignedSeller",
    "industry",
    "companySize",
    "sentiment",
  ] as const) {
    const value = sp.get(key);
    if (value !== null && value.length > 0) filters[key] = value;
  }
  const closed = sp.get("closed");
  if (closed === "true") filters.closed = true;
  else if (closed === "false") filters.closed = false;
  return filters as MetricFilters;
}
