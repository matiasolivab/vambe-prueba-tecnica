/**
 * Formats a `"YYYY-MM"` string as abbreviated Spanish month + apostrophed
 * two-digit year (e.g. `"2026-04"` → `"Abr '26"`).
 *
 * Contract: garbage-in, garbage-visible — invalid inputs return a passthrough
 * string so server-rendered UI stays non-crashing even if the DB yields an
 * unexpected shape. Empty string is treated as a sentinel for "no data" and
 * renders as an em-dash.
 */

const MONTHS_ES_ABBR = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

export function formatYearMonthEs(yyyyMM: string): string {
  if (yyyyMM === "") return "—";
  const match = YEAR_MONTH_RE.exec(yyyyMM);
  if (!match) return yyyyMM;
  const year = match[1]!;
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return yyyyMM;
  return `${MONTHS_ES_ABBR[monthIdx]} '${year.slice(2)}`;
}

/**
 * Returns the calendar month immediately preceding `yyyyMM`, preserving the
 * `"YYYY-MM"` shape. `"2026-01"` rolls over to `"2025-12"`. Invalid input
 * returns `""` so consumers can chain with `formatYearMonthEs` for a safe
 * "—" fallback.
 */
export function previousYearMonth(yyyyMM: string): string {
  if (yyyyMM === "") return "";
  const match = YEAR_MONTH_RE.exec(yyyyMM);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return "";
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}
