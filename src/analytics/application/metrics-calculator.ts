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

export interface MetricFilters {
  readonly assignedSeller?: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly closed?: boolean;
  readonly sentiment?: string;
}

export interface KpiMetrics {
  readonly totalClients: number;
  readonly topPainPoint: {
    readonly value: string;
    readonly count: number;
  } | null;
}

export interface SellerRanking {
  readonly name: string;
  readonly totalClients: number;
  readonly closedCount: number;
  readonly closeRate: number;
}

export interface SellerConversion {
  readonly seller: string;
  readonly totalClients: number;
  readonly closedClients: number;
  readonly openClients: number;
  readonly closeRate: number;
}

export interface PainPointCount {
  readonly painPoint: string;
  readonly count: number;
}

export interface CompanySizeCount {
  readonly companySize: string;
  readonly count: number;
}

export interface IndustryCount {
  readonly industry: string;
  readonly count: number;
}

export interface SellerByIndustryCell {
  readonly seller: string;
  readonly industry: string;
  readonly total: number;
  readonly closed: number;
  readonly closeRate: number;
}

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

  public async sellerConversion(
    filters?: MetricFilters,
  ): Promise<readonly SellerConversion[]> {
    const where = this.buildWhere(filters);
    const rows = await this.db
      .select({
        seller: clients.assignedSeller,
        total: sql<number>`count(*)::int`,
        closed: sql<number>`sum(case when ${clients.closed} then 1 else 0 end)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.assignedSeller);
    return rows
      .map((r) => ({
        seller: r.seller,
        totalClients: r.total,
        closedClients: r.closed,
        openClients: r.total - r.closed,
        closeRate: safeRate(r.closed, r.total),
      }))
      .sort(
        (a, b) =>
          b.totalClients - a.totalClients ||
          a.seller.localeCompare(b.seller),
      );
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

  public async painPointCounts(
    filters?: MetricFilters,
  ): Promise<readonly PainPointCount[]> {
    const where = this.buildWhereClassified(filters, clients.mainPainPoint);
    const rows = await this.db
      .select({
        value: clients.mainPainPoint,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.mainPainPoint)
      .orderBy(desc(sql`count(*)`), asc(clients.mainPainPoint));
    return rows
      .filter((r): r is { value: string; count: number } => r.value !== null)
      .map((r) => ({ painPoint: r.value, count: r.count }));
  }

  public async companySizeDistribution(
    filters?: MetricFilters,
  ): Promise<readonly CompanySizeCount[]> {
    const where = this.buildWhereClassified(filters, clients.companySize);
    const rows = await this.db
      .select({
        value: clients.companySize,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.companySize)
      .orderBy(desc(sql`count(*)`), asc(clients.companySize));
    return rows
      .filter((r): r is { value: string; count: number } => r.value !== null)
      .map((r) => ({ companySize: r.value, count: r.count }));
  }

  public async topIndustries(
    filters?: MetricFilters,
    limit: number = 2,
  ): Promise<readonly IndustryCount[]> {
    const where = this.buildWhereClassified(filters, clients.industry);
    const rows = await this.db
      .select({
        value: clients.industry,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(where)
      .groupBy(clients.industry)
      .orderBy(desc(sql`count(*)`), asc(clients.industry));
    return rows
      .filter((r): r is { value: string; count: number } =>
        r.value !== null && r.value !== "Otros",
      )
      .slice(0, limit)
      .map((r) => ({ industry: r.value, count: r.count }));
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

function safeRate(closed: number, total: number): number {
  if (!total) return 0;
  return closed / total;
}

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
