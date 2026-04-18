import { neon } from "@neondatabase/serverless";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import type {
  ClientFilters,
  ClientRepository,
} from "../application/client-repository";
import { clients, type Client, type NewClient } from "./db/schema";

export class DrizzleClientRepository implements ClientRepository {
  public constructor(private readonly db: NeonHttpDatabase) {}

  public async upsertByEmail(input: NewClient): Promise<Client> {
    const [row] = await this.db
      .insert(clients)
      .values(input)
      .onConflictDoUpdate({
        target: clients.email,
        set: {
          name: input.name,
          phone: input.phone,
          meetingDate: input.meetingDate,
          assignedSeller: input.assignedSeller,
          closed: input.closed,
          transcript: input.transcript,
          industry: input.industry,
          companySize: input.companySize,
          mainPainPoint: input.mainPainPoint,
          keyObjection: input.keyObjection,
          leadSource: input.leadSource,
          sentiment: input.sentiment,
          needsSummary: input.needsSummary,
          nextSteps: input.nextSteps,
          reasoning: input.reasoning,
          promptVersion: input.promptVersion,
          modelVersion: input.modelVersion,
          truncated: input.truncated,
          classificationStatus: input.classificationStatus,
          errorMessage: input.errorMessage,
          warnings: input.warnings,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    if (!row) {
      throw new Error(
        `upsertByEmail returned no row for email=${input.email}`,
      );
    }
    return row;
  }

  public async findByEmail(email: string): Promise<Client | null> {
    const [row] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.email, email))
      .limit(1);
    return row ?? null;
  }

  public async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients);
    return row?.count ?? 0;
  }

  public async findAll(
    filters?: ClientFilters,
  ): Promise<readonly Client[]> {
    const where = this.buildWhere(filters);
    return this.db
      .select()
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt));
  }

  public async distinctSellers(): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ name: clients.assignedSeller })
      .from(clients)
      .orderBy(asc(clients.assignedSeller));
    return rows.map((r) => r.name);
  }

  private buildWhere(filters?: ClientFilters): SQL | undefined {
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
    if (filters.search !== undefined && filters.search.length > 0) {
      const pattern = `%${filters.search}%`;
      const nameMatch = ilike(clients.name, pattern);
      const emailMatch = ilike(clients.email, pattern);
      conds.push(or(nameMatch, emailMatch) as SQL);
    }
    if (conds.length === 0) return undefined;
    if (conds.length === 1) return conds[0];
    return and(...conds);
  }
}

export function createDrizzleClientRepository(): DrizzleClientRepository {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Populate .env.local (see .env.example).",
    );
  }
  const client = neon(url);
  const db = drizzle(client);
  return new DrizzleClientRepository(db);
}
