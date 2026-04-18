import { neon } from "@neondatabase/serverless";
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgColumn } from "drizzle-orm/pg-core";

import { clients } from "@/clients/infrastructure/db/schema";

/**
 * Filters applied to every metric query. Every field is optional — an absent
 * field means "no constraint on this dimension". An explicit `false` on
 * `closed` is a real constraint (not "unset").
 */
export interface MetricFilters {
  readonly assignedSeller?: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly closed?: boolean;
  readonly sentiment?: string;
}

/**
 * KPI tiles for dashboard Overview. Close-rate, close-rate-by-dimension and
 * objections were dropped in favour of the temporal metrics powering the
 * MoM delta + 12-month trend chart.
 */
export interface KpiMetrics {
  readonly totalClients: number;
  readonly topPainPoint: {
    readonly value: string;
    readonly count: number;
  } | null;
}

/** One row of the sellers ranking. */
export interface SellerRanking {
  readonly name: string;
  readonly totalClients: number;
  readonly closedCount: number;
  readonly closeRate: number;
}

/** One cell of the sellers × industries crosstab. */
export interface SellerByIndustryCell {
  readonly seller: string;
  readonly industry: string;
  readonly total: number;
  readonly closed: number;
  readonly closeRate: number;
}

/**
 * Analytics service — computes every dashboard metric server-side (RF3.1)
 * with DB-level aggregations so filters recompute in <200ms (RNF1.3).
 *
 * Every method accepts optional `MetricFilters`. `closeRate` values in the
 * sellers ranking emit `0` (never NaN/null) when totals are zero, so the UI
 * never renders divide-by-zero artefacts.
 */
export class MetricsCalculator {
  public constructor(private readonly db: NeonHttpDatabase) {}

  public async kpis(filters?: MetricFilters): Promise<KpiMetrics> {
    const where = this.buildWhere(filters);
    const [totals, painPoints] = await Promise.all([
      this.fetchTotals(where),
      this.fetchTopPainPoint(where),
    ]);
    return { totalClients: totals.total, topPainPoint: painPoints };
  }

  public async sellerRanking(
    filters?: MetricFilters,
  ): Promise<readonly SellerRanking[]> {
    const where = this.buildWhere(filters);
    const rows = await this.db
      .select({
        name: clients.assignedSeller,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.assignedSeller)
      .orderBy(
        desc(sql`sum(case when ${clients.closed} then 1 else 0 end)::float / nullif(count(*), 0)`),
        desc(sql`count(*)`),
      );

    return rows.map((r) => ({
      name: r.name,
      totalClients: r.total,
      closedCount: r.closed,
      closeRate: safeRate(r.closed, r.total),
    }));
  }

  public async sellerByIndustry(
    filters?: MetricFilters,
  ): Promise<readonly SellerByIndustryCell[]> {
    const where = this.buildWhereClassified(filters, clients.industry);
    const rows = await this.db
      .select({
        seller: clients.assignedSeller,
        industry: clients.industry,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.assignedSeller, clients.industry)
      .orderBy(asc(clients.assignedSeller), asc(clients.industry));

    return rows
      .filter(
        (r): r is {
          seller: string;
          industry: string;
          total: number;
          closed: number;
        } => typeof r.industry === "string" && typeof r.seller === "string",
      )
      .map((r) => ({
        seller: r.seller,
        industry: r.industry,
        total: r.total,
        closed: r.closed,
        closeRate: safeRate(r.closed, r.total),
      }));
  }

  // --- private helpers -----------------------------------------------------

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

  private buildWhereClassified(
    filters: MetricFilters | undefined,
    notNullColumn: PgColumn,
  ): SQL {
    const base = this.buildWhere(filters);
    const notNull = isNotNull(notNullColumn);
    return base ? (and(base, notNull) as SQL) : notNull;
  }

  private async fetchTotals(
    where: SQL | undefined,
  ): Promise<{ total: number; closed: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where);
    return { total: row?.total ?? 0, closed: row?.closed ?? 0 };
  }

  private async fetchTopPainPoint(
    where: SQL | undefined,
  ): Promise<{ value: string; count: number } | null> {
    const combined = where
      ? (and(where, isNotNull(clients.mainPainPoint)) as SQL)
      : isNotNull(clients.mainPainPoint);
    const [row] = await this.db
      .select({
        value: clients.mainPainPoint,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(combined)
      .groupBy(clients.mainPainPoint)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    if (!row || row.value === null) return null;
    return { value: row.value, count: row.count };
  }
}

// Defensive divide — avoids NaN when the SQL aggregation returns 0/0.
function safeRate(closed: number, total: number): number {
  if (!total) return 0;
  return closed / total;
}

/**
 * Production factory. Reads `DATABASE_URL` from the environment and wires a
 * Neon HTTP driver, mirroring `createDrizzleClientRepository`.
 */
export function createMetricsCalculator(): MetricsCalculator {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Populate .env.local (see .env.example).",
    );
  }
  const client = neon(url);
  const db = drizzle(client);
  return new MetricsCalculator(db);
}
