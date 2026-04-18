import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";

/**
 * Distinct sellers used to populate the global `FiltersBar` (rendered
 * inside every `SectionHeader`). Centralised so pages don't import the
 * infrastructure layer directly — they compose `getDashboardSellers()`
 * alongside their own data fetch.
 */
export function getDashboardSellers(): Promise<readonly string[]> {
  return createDrizzleClientRepository().distinctSellers();
}
