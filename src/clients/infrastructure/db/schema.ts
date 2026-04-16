import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * `clients` table — single source of truth for sales-call records and their
 * LLM-derived classification.
 *
 * Design notes:
 * - The 8 categorical dimensions (§7.1) and `classificationStatus` are stored
 *   as `text`, NOT `pgEnum`. ARCHITECTURE §13 puts Zod at the classifier
 *   boundary as the enum gatekeeper; duplicating that as a DB-level enum would
 *   add migration friction without adding safety.
 * - `email` is UNIQUE: it is the natural upsert key for CSV ingestion
 *   (ARCHITECTURE §8).
 * - `warnings` is a `jsonb` array of `{ name, severity, message }` produced by
 *   the declarative `INCONSISTENCY_RULES` table (ARCHITECTURE §13 rule 12).
 * - `reasoning`, `promptVersion`, and `modelVersion` make every classification
 *   auditable and enable selective re-classification on prompt/model changes
 *   (ARCHITECTURE §13 rules 4 & 5).
 */
export const clients = pgTable("clients", {
  // --- identity / source CSV -------------------------------------------------
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  assignedSeller: text("assigned_seller").notNull(),
  closed: boolean("closed").notNull(),
  transcript: text("transcript").notNull(),

  // --- LLM categorical dimensions (PRD §7.1) ---------------------------------
  industry: text("industry"),
  companySize: text("company_size"),
  mainPainPoint: text("main_pain_point"),
  keyObjection: text("key_objection"),
  purchaseTimeline: text("purchase_timeline"),
  buyingSignal: text("buying_signal"),
  decisionMakerRole: text("decision_maker_role"),
  sentiment: text("sentiment"),

  // --- LLM qualitative (PRD §7.2) --------------------------------------------
  needsSummary: text("needs_summary"),
  nextSteps: text("next_steps"),

  // --- LLM traceability (PRD §7.3 + ARCHITECTURE §13) ------------------------
  reasoning: text("reasoning"),
  promptVersion: text("prompt_version"),
  modelVersion: text("model_version"),
  truncated: boolean("truncated").notNull().default(false),
  classificationStatus: text("classification_status")
    .notNull()
    .default("pending"),
  errorMessage: text("error_message"),
  warnings: jsonb("warnings")
    .notNull()
    .default(sql`'[]'::jsonb`),

  // --- timestamps ------------------------------------------------------------
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
