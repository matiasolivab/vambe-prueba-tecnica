import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Populate .env.local.");
}

export default defineConfig({
  schema: "./src/clients/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
