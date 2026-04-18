import { neon } from "@neondatabase/serverless";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { clients } from "@/clients/infrastructure/db/schema";
import { previousYearMonth } from "@/shared/date/format-month-es";

import type { MetricFilters } from "./metrics-calculator";

export interface MonthlyClientsPoint {
  readonly yearMonth: string;
  readonly closed: number;
  readonly open: number;
}

export interface ClientCountMoM {
  readonly current: number;
  readonly previous: number;
  readonly deltaPct: number | null;
  readonly referenceYearMonth: string;
}

export interface TopSellerByMonth {
  readonly name: string;
  readonly closedInMonth: number;
  readonly totalInMonth: number;
  readonly closeRateInMonth: number;
  readonly yearMonth: string;
}

export class TemporalMetrics {
  public constructor(private readonly db: NeonHttpDatabase) {}

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

  public async clientCountMoM(
    filters?: MetricFilters,
  ): Promise<ClientCountMoM> {
    const where = this.buildWhere(filters);
    const anchor = await this.fetchAnchorYearMonth(where);
    if (!anchor) {
      return { current: 0, previous: 0, deltaPct: null, referenceYearMonth: "" };
    }
    const { current, previous } = await this.fetchCurrentAndPreviousCounts(
      where,
      anchor,
    );
    return {
      current,
      previous,
      deltaPct: computeDeltaPct(current, previous),
      referenceYearMonth: anchor,
    };
  }

  public async topSellerByMonth(
    filters?: MetricFilters,
  ): Promise<TopSellerByMonth | null> {
    const where = this.buildWhere({ ...(filters ?? {}), closed: undefined });
    const anchor = await this.fetchAnchorYearMonth(where);
    if (!anchor) return null;
    return this.fetchTopRankedSellerForMonth(where, anchor);
  }

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

  private async fetchCurrentAndPreviousCounts(
    where: SQL | undefined,
    anchor: string,
  ): Promise<{ current: number; previous: number }> {
    const anchorDate = `${anchor}-01`;
    const [row] = await this.db
      .select({
        current: sql<number>`count(*) filter (
          where date_trunc('month', ${clients.meetingDate})
              = date_trunc('month', ${anchorDate}::date)
        )::int`,
        previous: sql<number>`count(*) filter (
          where date_trunc('month', ${clients.meetingDate})
              = date_trunc('month', ${anchorDate}::date) - interval '1 month'
        )::int`,
      })
      .from(clients)
      .where(where);
    return { current: row?.current ?? 0, previous: row?.previous ?? 0 };
  }

  private async fetchTopRankedSellerForMonth(
    where: SQL | undefined,
    anchor: string,
  ): Promise<TopSellerByMonth | null> {
    const anchorDate = `${anchor}-01`;
    const monthScope = sql`date_trunc('month', ${clients.meetingDate}) = date_trunc('month', ${anchorDate}::date)`;
    const sellerNotNull = sql`${clients.assignedSeller} is not null`;
    const scoped = where
      ? (and(where, monthScope, sellerNotNull) as SQL)
      : (and(monthScope, sellerNotNull) as SQL);
    const [row] = await this.db
      .select({
        name: clients.assignedSeller,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(scoped)
      .groupBy(clients.assignedSeller)
      .having(sql`sum(case when ${clients.closed} then 1 else 0 end) > 0`)
      .orderBy(
        sql`sum(case when ${clients.closed} then 1 else 0 end) desc`,
        sql`sum(case when ${clients.closed} then 1 else 0 end)::float
            / nullif(count(*), 0) desc`,
        asc(clients.assignedSeller),
      )
      .limit(1);
    if (!row) return null;
    return {
      name: row.name,
      closedInMonth: row.closed,
      totalInMonth: row.total,
      closeRateInMonth: row.total === 0 ? 0 : row.closed / row.total,
      yearMonth: anchor,
    };
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

function computeDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
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
