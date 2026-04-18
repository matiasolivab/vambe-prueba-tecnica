import type { Client, NewClient } from "../infrastructure/db/schema";

export interface ClientFilters {
  readonly assignedSeller?: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly closed?: boolean;
  readonly sentiment?: string;
  readonly search?: string;
}

export interface ClientRepository {
  upsertByEmail(client: NewClient): Promise<Client>;
  findByEmail(email: string): Promise<Client | null>;
  count(): Promise<number>;
  findAll(filters?: ClientFilters): Promise<readonly Client[]>;
  distinctSellers(): Promise<readonly string[]>;
}
