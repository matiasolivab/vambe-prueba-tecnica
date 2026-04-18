import { neon } from "@neondatabase/serverless";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { clients } from "@/clients/infrastructure/db/schema";
import { previousYearMonth } from "@/shared/date/format-month-es";

import type { MetricFilters } from "./metrics-calculator";

/**
 * Time-anchored analytics for the dashboard Overview: 12-month trend,
 * month-over-month delta on total clients, and top seller of the anchor
 * month. Every method anchors its window to `MAX(meeting_date)` of the
 * filtered dataset — never to `now()` — so an idle weekend never flattens
 * the tile into "Sin datos".
 *
 * Split from {@link MetricsCalculator} to keep single-responsibility: those
 * aggregations are global/static, these are temporal/anchored. The
 * `buildWhere` helper is intentionally duplicated (rule-of-three).
 */

/** One point of the 12-month clients series. */
export interface MonthlyClientsPoint {
  readonly yearMonth: string; // "YYYY-MM"
  readonly closed: number;
  readonly open: number;
}

export class TemporalMetrics {
  public constructor(private readonly db: NeonHttpDatabase) {}

  /**
   * Returns 12 ascending monthly buckets anchored at MAX(meeting_date).
   * Missing months inside the window are filled with {closed:0, open:0}.
   * Returns `[]` when the filtered dataset has no rows at all.
   *
   * The chart's raison d'être is comparing closed vs open series — applying
   * `filters.closed` would flatten one of the two lines. We strip it locally.
   */
  public async clientsByMonth(
    filters?: MetricFilters,
  ): Promise<readonly MonthlyClientsPoint[]> {
    const where = this.buildWhere({ ...(filters ?? {}), closed: undefined });
    const anchor = await this.fetchAnchorYearMonth(where);
    if (!anchor) return [];
    const rows = await this.fetchMonthlyBuckets(where, anchor);
    const byMonth = new Map(rows.map((r) => [r.yearMonth, r] as const));
    return expandToTwelveMonths(anchor, byMonth);
  }

  // --- private helpers -----------------------------------------------------

  // NOTE: mirrored from MetricsCalculator.buildWhere — see design §2.
  // Duplicated on purpose (rule-of-three); if a third service needs this,
  // extract to `src/analytics/application/filters-sql.ts`.
  private buildWhere(filters?: MetricFilters): SQL | undefined {
    if (!filters) return undefined;
    const conds: SQL[] = [];
    if (filters.assignedSeller !== undefined) {
      conds.push(eq(clients.assignedSeller, filters.assignedSeller));
    }
    if (filters.industry !== undefined) {
      conds.push(eq(clients.industry, filters.industry));
    }
    if (filters.companySize !== undefined) {
      conds.push(eq(clients.companySize, filters.companySize));
    }
    if (filters.closed !== undefined) {
      conds.push(eq(clients.closed, filters.closed));
    }
    if (filters.sentiment !== undefined) {
      conds.push(eq(clients.sentiment, filters.sentiment));
    }
    if (conds.length === 0) return undefined;
    if (conds.length === 1) return conds[0];
    return and(...conds);
  }

  private async fetchAnchorYearMonth(
    where: SQL | undefined,
  ): Promise<string | null> {
    const [row] = await this.db
      .select({
        ym: sql<
          string | null
        >`to_char(date_trunc('month', max(${clients.meetingDate})), 'YYYY-MM')`,
      })
      .from(clients)
      .where(where);
    return row?.ym ?? null;
  }

  private async fetchMonthlyBuckets(
    where: SQL | undefined,
    anchor: string,
  ): Promise<
    ReadonlyArray<{ yearMonth: string; closed: number; open: number }>
  > {
    const anchorDate = `${anchor}-01`;
    return this.db
      .select({
        yearMonth: sql<string>`to_char(date_trunc('month', ${clients.meetingDate}), 'YYYY-MM')`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
        open: sql<number>`sum(case when not ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(
        where
          ? (and(
              where,
              sql`${clients.meetingDate} >= date_trunc('month', ${anchorDate}::date) - interval '11 months'`,
              sql`${clients.meetingDate} <  date_trunc('month', ${anchorDate}::date) + interval '1 month'`,
            ) as SQL)
          : (and(
              sql`${clients.meetingDate} >= date_trunc('month', ${anchorDate}::date) - interval '11 months'`,
              sql`${clients.meetingDate} <  date_trunc('month', ${anchorDate}::date) + interval '1 month'`,
            ) as SQL),
      )
      .groupBy(sql`1`)
      .orderBy(asc(sql`1`));
  }
}

function expandToTwelveMonths(
  anchorYearMonth: string,
  rows: ReadonlyMap<string, { yearMonth: string; closed: number; open: number }>,
): MonthlyClientsPoint[] {
  const months: string[] = [];
  let cursor = anchorYearMonth;
  for (let i = 0; i < 12; i++) {
    months.push(cursor);
    cursor = previousYearMonth(cursor);
  }
  months.reverse();
  return months.map((ym) => {
    const row = rows.get(ym);
    return {
      yearMonth: ym,
      closed: row?.closed ?? 0,
      open: row?.open ?? 0,
    };
  });
}

/**
 * Production factory. Reads `DATABASE_URL` from the environment and wires a
 * Neon HTTP driver, mirroring {@link createMetricsCalculator}.
 */
export function createTemporalMetrics(): TemporalMetrics {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Populate .env.local (see .env.example).",
    );
  }
  const client = neon(url);
  const db = drizzle(client);
  return new TemporalMetrics(db);
}
