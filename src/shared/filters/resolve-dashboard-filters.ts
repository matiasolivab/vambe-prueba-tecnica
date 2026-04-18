import type { MetricFilters } from "@/analytics/application/metrics-calculator";
import type { ClientFilters } from "@/clients/application/client-repository";

import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "./parse-filters";

/**
 * Dashboard pages in Next 16 receive `searchParams` as a Promise. Awaiting
 * and parsing happens the same way in every page — centralise it here so
 * each `page.tsx` stays a 2-liner over what it actually renders.
 */
export type DashboardSearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export interface ResolvedDashboardFilters {
  readonly filters: ClientFilters;
  readonly metricFilters: MetricFilters;
}

export async function resolveDashboardFilters(
  searchParams: DashboardSearchParams,
): Promise<ResolvedDashboardFilters> {
  const sp = await searchParams;
  const filters = parseFiltersFromSearchParams(sp);
  return { filters, metricFilters: metricFiltersOf(filters) };
}
