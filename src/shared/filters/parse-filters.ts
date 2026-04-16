import type { MetricFilters } from "@/analytics/application/metrics-calculator";
import type { ClientFilters } from "@/clients/application/client-repository";

/**
 * URL ↔ domain filters bridge (PRD §RF3.2 — filtros globales aplican a
 * TODAS las secciones — + §RF3.4 — búsqueda por nombre/email).
 *
 * This helper is the **single source of truth** for:
 *   - which URL keys the dashboard accepts (`vendor`, `industry`, `size`,
 *     `closed`, `sentiment`, `search`);
 *   - how each key maps to {@link ClientFilters};
 *   - how `closed` is coerced to a boolean (only the literal strings
 *     `"true"` and `"false"` count — anything else is "unset", so we never
 *     silently downgrade a malformed URL to `closed=false`).
 *
 * Both the API routes (`/api/clients`, `/api/metrics`) and the Server
 * Component page (`src/app/page.tsx`) import this helper so the URL
 * contract never drifts between layers.
 *
 * URL keys are intentionally short/human-readable (`vendor`, `size`)
 * because users see them in the address bar. The domain types keep the
 * precise names (`assignedSeller`, `companySize`).
 */

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/**
 * Accepts either a `URLSearchParams` (API route style) or the
 * `searchParams` object Next 16 passes to Server Component pages (keys →
 * `string | string[] | undefined`). Arrays collapse to their first value
 * — the filter strip is single-select per dimension.
 */
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
  // Any other value (including "" and missing) → leave undefined.

  const search = get("search");
  if (search && search.length > 0) out.search = search;

  return out;
}

/**
 * Extract the subset of filters that applies to metrics aggregations.
 * `search` is a table-only filter (RF3.4) — metrics are categorical, so
 * a substring match against name/email would be meaningless there.
 */
export function metricFiltersOf(filters: ClientFilters): MetricFilters {
  const { search: _search, ...rest } = filters;
  void _search;
  return rest;
}
