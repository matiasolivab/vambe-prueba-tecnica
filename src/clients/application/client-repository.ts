import type { Client, NewClient } from "../infrastructure/db/schema";

/**
 * Port for the `clients` persistence boundary.
 *
 * Screaming Architecture: this interface lives in `application/` so the
 * domain depends on it but never on Drizzle. Adapters in `infrastructure/`
 * implement it.
 *
 * Natural key is `email` (ARCHITECTURE §8, PRD RF1.3). Re-ingesting the same
 * CSV row updates every non-identity column in place — id and createdAt are
 * preserved for audit trails.
 */
export interface ClientRepository {
  /**
   * Insert a client or update every non-identity column if the email already
   * exists (Postgres `ON CONFLICT DO UPDATE` against the UNIQUE index on
   * `clients.email`). Returns the final persisted row.
   */
  upsertByEmail(client: NewClient): Promise<Client>;

  /**
   * Fetch by email. Returns `null` (not throws) when no row matches, so
   * callers can treat absence as a normal control-flow case.
   */
  findByEmail(email: string): Promise<Client | null>;

  /** Total rows in the `clients` table. Used by smoke checks and tests. */
  count(): Promise<number>;
}
