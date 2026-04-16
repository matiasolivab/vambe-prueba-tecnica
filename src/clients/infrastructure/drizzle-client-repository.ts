import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import type { ClientRepository } from "../application/client-repository";
import { clients, type Client, type NewClient } from "./db/schema";

/**
 * Drizzle + `@neondatabase/serverless` adapter for `ClientRepository`.
 *
 * The class stays DI-pure (constructor takes a `NeonHttpDatabase`) so it can
 * be swapped with a test double if needed. Production wiring goes through
 * the `createDrizzleClientRepository` factory below, which reads
 * `DATABASE_URL` once.
 */
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
          purchaseTimeline: input.purchaseTimeline,
          buyingSignal: input.buyingSignal,
          decisionMakerRole: input.decisionMakerRole,
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
          // `now()` on the DB side avoids clock skew vs. app server.
          updatedAt: sql`now()`,
        },
      })
      .returning();

    if (!row) {
      // RETURNING on a successful insert/update always yields one row.
      // Reaching here means the driver lied; fail loudly.
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

}

/**
 * Production factory: reads `DATABASE_URL` from the environment and wires a
 * Neon HTTP driver. Throws a clear error when the env is missing so we never
 * boot against an accidental local default.
 *
 * Callers that want to inject a mocked `db` should construct
 * `DrizzleClientRepository` directly and skip this helper.
 */
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
