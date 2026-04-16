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

/**
 * Filters applied to {@link ClientRepository.findAll} — PRD §RF3.2 (same
 * filter set applies to both the metrics endpoint and the clients list) and
 * §RF3.4 (search by name OR email).
 *
 * Every field is optional; an absent field imposes no constraint on that
 * dimension. An explicit `closed: false` IS a constraint (not "unset").
 * `search` does case-insensitive substring matching on BOTH `name` and
 * `email` (OR'd); the other fields are exact matches AND'd together.
 */
export interface ClientFilters {
  readonly assignedSeller?: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly closed?: boolean;
  readonly sentiment?: string;
  readonly search?: string;
}

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

  /**
   * List clients filtered by any subset of {@link ClientFilters}. Returns
   * rows ordered by `createdAt DESC` (newest first — the default dashboard
   * table order). Absent filters → no constraint on that column.
   */
  findAll(filters?: ClientFilters): Promise<readonly Client[]>;

  /**
   * Every unique `assignedSeller` present in the `clients` table, ordered
   * alphabetically (ASC). Used to populate the "Vendedor" dropdown in the
   * global filter strip (RF3.2) — we derive the list from real data
   * instead of hardcoding because seller rosters drift over time.
   */
  distinctSellers(): Promise<readonly string[]>;
}
