import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { clients } from "../src/clients/infrastructure/db/schema";

loadEnv({ path: ".env.local", override: true });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Populate .env.local.");
  }

  const client = neon(url);
  const db = drizzle(client);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients);
  const rowCount = rows[0]?.count ?? 0;

  console.log(`[db-smoke] clients table reachable. Row count: ${rowCount}.`);
}

main().catch((err) => {
  console.error("[db-smoke] FAILED:", err);
  process.exit(1);
});
