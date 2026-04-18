ALTER TABLE "clients" DROP COLUMN "buying_signal";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_source" text;
