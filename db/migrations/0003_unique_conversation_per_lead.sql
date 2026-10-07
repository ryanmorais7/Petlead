DROP INDEX "conversations_lead_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_lead_idx" ON "conversations" USING btree ("lead_id");