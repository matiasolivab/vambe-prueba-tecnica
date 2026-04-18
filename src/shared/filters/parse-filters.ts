import type { MetricFilters } from "@/analytics/application/metrics-calculator";
import type { ClientFilters } from "@/clients/application/client-repository";

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseFiltersFromSearchParams(
  sp: SearchParamsLike,
): ClientFilters {
  const get = (key: string): string | undefined => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(key);
      return v === null ? undefined : v;
    }
    const raw = sp[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const out: {
    assignedSeller?: string;
    industry?: string;
    companySize?: string;
    closed?: boolean;
    sentiment?: string;
    search?: string;
  } = {};

  const seller = get("vendor");
  if (seller && seller.length > 0) out.assignedSeller = seller;

  const industry = get("industry");
  if (industry && industry.length > 0) out.industry = industry;

  const size = get("size");
  if (size && size.length > 0) out.companySize = size;

  const sentiment = get("sentiment");
  if (sentiment && sentiment.length > 0) out.sentiment = sentiment;

  const closed = get("closed");
  if (closed === "true") out.closed = true;
  else if (closed === "false") out.closed = false;

  const search = get("search");
  if (search && search.length > 0) out.search = search;

  return out;
}

export function metricFiltersOf(filters: ClientFilters): MetricFilters {
  const { search: _search, ...rest } = filters;
  void _search;
  return rest;
}
