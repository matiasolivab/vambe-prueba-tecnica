import type { MetricFilters } from "@/analytics/application/metrics-calculator";
import type { ClientFilters } from "@/clients/application/client-repository";

import {
  metricFiltersOf,
  parseFiltersFromSearchParams,
} from "./parse-filters";

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
