import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";

export function getDashboardSellers(): Promise<readonly string[]> {
  return createDrizzleClientRepository().distinctSellers();
}
