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
