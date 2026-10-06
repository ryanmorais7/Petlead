CREATE TYPE "public"."followup_status" AS ENUM('PENDING', 'READY', 'APPROVED', 'SENT', 'CANCELLED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."lead_event_type" AS ENUM('LEAD_CREATED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'STATUS_CHANGED', 'FOLLOWUP_CREATED', 'FOLLOWUP_SENT', 'SALE_CLOSED', 'DO_NOT_CONTACT_SET');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'INDICACAO', 'PANFLETO', 'INFLUENCIADOR', 'CONDOMINIO', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'INTERESTED', 'HOT', 'THINKING', 'WAITING_FAMILY', 'COMPARING_COMPETITOR', 'WAITING_DOCUMENTS', 'WAITING_PAYMENT', 'NO_RESPONSE', 'FOLLOW_UP', 'READY_TO_CLOSE', 'CLOSED', 'LOST', 'DO_NOT_CONTACT');--> statement-breakpoint
CREATE TYPE "public"."lead_temperature" AS ENUM('HOT', 'WARM', 'COLD');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('RECEIVED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('TEXT', 'AUDIO', 'IMAGE', 'DOCUMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type" AS ENUM('REPLY', 'FOLLOW_UP', 'REACTIVATION', 'CLOSING');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SELLER');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"conversation_id" uuid,
	"type" "suggestion_type" NOT NULL,
	"content" text NOT NULL,
	"reason" text,
	"confidence" real,
	"approved" boolean DEFAULT false NOT NULL,
	"edited_content" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_suggestions_confidence_range" CHECK ("ai_suggestions"."confidence" is null or "ai_suggestions"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "conversation_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"customer_intent" text,
	"main_objection" text,
	"recommended_next_action" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_summaries_leadId_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"whatsapp_conversation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" "followup_status" DEFAULT 'PENDING' NOT NULL,
	"sequence_step" integer,
	"ai_suggestion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "lead_event_type" NOT NULL,
	"description" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"source" "lead_source" DEFAULT 'WHATSAPP' NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"temperature" "lead_temperature" DEFAULT 'COLD' NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"main_objection" text,
	"lost_reason" text,
	"notes" text,
	"pet_count" integer,
	"pet_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"plan_interest" text,
	"last_contact_at" timestamp with time zone,
	"next_followup_at" timestamp with time zone,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_score_range" CHECK ("leads"."lead_score" between 0 and 100),
	CONSTRAINT "leads_pet_count_positive" CHECK ("leads"."pet_count" is null or "leads"."pet_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"whatsapp_message_id" text,
	"direction" "message_direction" NOT NULL,
	"type" "message_type" DEFAULT 'TEXT' NOT NULL,
	"text" text,
	"timestamp" timestamp with time zone NOT NULL,
	"status" "message_status" NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_whatsappMessageId_unique" UNIQUE("whatsapp_message_id")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"plan_name" text,
	"monthly_value" numeric(10, 2),
	"source" "lead_source" NOT NULL,
	"followup_id" uuid,
	"notes" text,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'SELLER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"status" "webhook_event_status" DEFAULT 'RECEIVED' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_ai_suggestion_id_ai_suggestions_id_fk" FOREIGN KEY ("ai_suggestion_id") REFERENCES "public"."ai_suggestions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_followup_id_followups_id_fk" FOREIGN KEY ("followup_id") REFERENCES "public"."followups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_suggestions_lead_created_idx" ON "ai_suggestions" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_lead_idx" ON "conversations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "followups_lead_idx" ON "followups" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "followups_status_scheduled_idx" ON "followups" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "lead_events_lead_created_idx" ON "lead_events" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_owner_phone_idx" ON "leads" USING btree ("owner_user_id","phone");--> statement-breakpoint
CREATE INDEX "leads_owner_status_idx" ON "leads" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "leads_next_followup_idx" ON "leads" USING btree ("next_followup_at");--> statement-breakpoint
CREATE INDEX "leads_last_contact_idx" ON "leads" USING btree ("last_contact_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_timestamp_idx" ON "messages" USING btree ("conversation_id","timestamp");--> statement-breakpoint
CREATE INDEX "messages_lead_timestamp_idx" ON "messages" USING btree ("lead_id","timestamp");--> statement-breakpoint
CREATE INDEX "sales_owner_closed_idx" ON "sales" USING btree ("owner_user_id","closed_at");--> statement-breakpoint
CREATE INDEX "sales_lead_idx" ON "sales" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_events_status_idx" ON "whatsapp_webhook_events" USING btree ("status","received_at");