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
 * KPI tiles for dashboard §8.1.
 * `closeRate` is in [0, 1]; 0 when totalClients is 0 (never NaN).
 */
export interface KpiMetrics {
  readonly totalClients: number;
  readonly closeRate: number;
  readonly topSeller: {
    readonly name: string;
    readonly closeRate: number;
  } | null;
  readonly topPainPoint: {
    readonly value: string;
    readonly count: number;
  } | null;
}

/** One row of the sellers ranking (§8.2). */
export interface SellerRanking {
  readonly name: string;
  readonly totalClients: number;
  readonly closedCount: number;
  readonly closeRate: number;
}

/** One bucket of a single-dimension close-rate breakdown (§8.3). */
export interface DimensionRate {
  readonly value: string;
  readonly total: number;
  readonly closed: number;
  readonly closeRate: number;
}

/** One cell of the sellers × industries crosstab (§8.2). */
export interface SellerByIndustryCell {
  readonly seller: string;
  readonly industry: string;
  readonly total: number;
  readonly closed: number;
  readonly closeRate: number;
}

/** Objections broken down by deal outcome (§8.4). */
export interface ObjectionBreakdown {
  readonly inClosed: readonly DimensionRate[];
  readonly inNotClosed: readonly DimensionRate[];
}

export type CloseRateDimension =
  | "industry"
  | "companySize"
  | "decisionMakerRole"
  | "sentiment"
  | "buyingSignal"
  | "purchaseTimeline";

// Map public dimension names → Drizzle column references. Keeping the map
// internal means the service API stays string-typed while SQL stays type-safe.
const DIMENSION_COLUMNS: Readonly<Record<CloseRateDimension, PgColumn>> = {
  industry: clients.industry,
  companySize: clients.companySize,
  decisionMakerRole: clients.decisionMakerRole,
  sentiment: clients.sentiment,
  buyingSignal: clients.buyingSignal,
  purchaseTimeline: clients.purchaseTimeline,
};

/**
 * Analytics service — computes every dashboard metric server-side (RF3.1)
 * with DB-level aggregations so filters recompute in <200ms (RNF1.3).
 *
 * Every method accepts optional `MetricFilters`. When `totalClients === 0`
 * we always emit `closeRate: 0` (never NaN/null) so the UI never renders
 * divide-by-zero artefacts.
 */
export class MetricsCalculator {
  public constructor(private readonly db: NeonHttpDatabase) {}

  public async kpis(filters?: MetricFilters): Promise<KpiMetrics> {
    const where = this.buildWhere(filters);
    const [totals, sellers, painPoints] = await Promise.all([
      this.fetchTotals(where),
      this.fetchTopSeller(where),
      this.fetchTopPainPoint(where),
    ]);

    return {
      totalClients: totals.total,
      closeRate: safeRate(totals.closed, totals.total),
      topSeller: sellers,
      topPainPoint: painPoints,
    };
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

  public async closeRateBy(
    dimension: CloseRateDimension,
    filters?: MetricFilters,
  ): Promise<readonly DimensionRate[]> {
    const column = DIMENSION_COLUMNS[dimension];
    const where = this.buildWhereClassified(filters, column);
    // Project `column` through a `sql` expression so the row type is stable
    // regardless of which dimension is selected.
    const rows = await this.db
      .select({
        value: sql<string | null>`${column}`,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(column)
      .orderBy(desc(sql`count(*)`));

    return rows
      .filter(
        (r): r is { value: string; total: number; closed: number } =>
          typeof r.value === "string",
      )
      .map((r) => ({
        value: r.value,
        total: r.total,
        closed: r.closed,
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

  public async objections(
    filters?: MetricFilters,
  ): Promise<ObjectionBreakdown> {
    const [inClosed, inNotClosed] = await Promise.all([
      this.fetchObjections(filters, true),
      this.fetchObjections(filters, false),
    ]);
    return { inClosed, inNotClosed };
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

  private async fetchTopSeller(
    where: SQL | undefined,
  ): Promise<{ name: string; closeRate: number } | null> {
    const [row] = await this.db
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
      )
      .limit(1);
    if (!row) return null;
    return { name: row.name, closeRate: safeRate(row.closed, row.total) };
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

  private async fetchObjections(
    filters: MetricFilters | undefined,
    closed: boolean,
  ): Promise<readonly DimensionRate[]> {
    const base = this.buildWhere({ ...(filters ?? {}), closed });
    const where = base
      ? (and(base, isNotNull(clients.keyObjection)) as SQL)
      : isNotNull(clients.keyObjection);
    const rows = await this.db
      .select({
        value: clients.keyObjection,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.keyObjection)
      .orderBy(desc(sql`count(*)`));
    return rows
      .filter((r): r is { value: string; total: number; closed: number } =>
        typeof r.value === "string",
      )
      .map((r) => ({
        value: r.value,
        total: r.total,
        closed: r.closed,
        closeRate: safeRate(r.closed, r.total),
      }));
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
