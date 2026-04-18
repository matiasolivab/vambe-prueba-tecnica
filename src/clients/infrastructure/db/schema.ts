import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  assignedSeller: text("assigned_seller").notNull(),
  closed: boolean("closed").notNull(),
  transcript: text("transcript").notNull(),

  industry: text("industry"),
  companySize: text("company_size"),
  mainPainPoint: text("main_pain_point"),
  keyObjection: text("key_objection"),
  leadSource: text("lead_source"),
  sentiment: text("sentiment"),

  needsSummary: text("needs_summary"),
  nextSteps: text("next_steps"),

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

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
