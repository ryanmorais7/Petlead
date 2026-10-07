import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  FOLLOWUP_STATUSES,
  LEAD_EVENT_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  SUGGESTION_TYPES,
  USER_ROLES,
  WEBHOOK_EVENT_STATUSES,
} from "@/lib/domain/enums";
import type { SuggestionVariants } from "@/lib/validations/analysis";

// Column names are derived from the property names (snake_case) by the
// `casing` option set in drizzle.config.ts and db/index.ts.

const timestamptz = () => timestamp({ withTimezone: true, mode: "date" });
const createdAt = () => timestamptz().notNull().defaultNow();
const updatedAt = () =>
  timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const leadStatusEnum = pgEnum("lead_status", LEAD_STATUSES);
export const leadTemperatureEnum = pgEnum("lead_temperature", LEAD_TEMPERATURES);
export const leadSourceEnum = pgEnum("lead_source", LEAD_SOURCES);
export const messageDirectionEnum = pgEnum("message_direction", MESSAGE_DIRECTIONS);
export const messageTypeEnum = pgEnum("message_type", MESSAGE_TYPES);
export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);
export const suggestionTypeEnum = pgEnum("suggestion_type", SUGGESTION_TYPES);
export const followupStatusEnum = pgEnum("followup_status", FOLLOWUP_STATUSES);
export const leadEventTypeEnum = pgEnum("lead_event_type", LEAD_EVENT_TYPES);
export const webhookEventStatusEnum = pgEnum("webhook_event_status", WEBHOOK_EVENT_STATUSES);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Always stored in lower case. */
  email: text().notNull().unique(),
  /** Salted scrypt hash. Null means the account cannot sign in yet. */
  passwordHash: text(),
  failedLoginAttempts: integer().notNull().default(0),
  /** Set after too many wrong passwords; sign-in is refused until this moment. */
  lockedUntil: timestamptz(),
  role: userRoleEnum().notNull().default("SELLER"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text().notNull(),
    /** Digits only, with country code (E.164 without the plus sign). */
    phone: text().notNull(),
    email: text(),
    source: leadSourceEnum().notNull().default("WHATSAPP"),
    status: leadStatusEnum().notNull().default("NEW"),
    temperature: leadTemperatureEnum().notNull().default("COLD"),
    leadScore: integer().notNull().default(0),
    mainObjection: text(),
    lostReason: text(),
    notes: text(),
    /** Null while the number of pets is still unknown. */
    petCount: integer(),
    petNames: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    planInterest: text(),
    lastContactAt: timestamptz(),
    nextFollowupAt: timestamptz(),
    doNotContact: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("leads_owner_phone_idx").on(table.ownerUserId, table.phone),
    index("leads_owner_status_idx").on(table.ownerUserId, table.status),
    index("leads_next_followup_idx").on(table.nextFollowupAt),
    index("leads_last_contact_idx").on(table.lastContactAt),
    check("leads_score_range", sql`${table.leadScore} between 0 and 100`),
    check("leads_pet_count_positive", sql`${table.petCount} is null or ${table.petCount} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Conversations and messages
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    whatsappConversationId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("conversations_lead_idx").on(table.leadId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Unique id assigned by WhatsApp. Guarantees webhook idempotency. */
    whatsappMessageId: text().unique(),
    direction: messageDirectionEnum().notNull(),
    type: messageTypeEnum().notNull().default("TEXT"),
    text: text(),
    /** Moment the message was sent or received on WhatsApp. */
    timestamp: timestamptz().notNull(),
    status: messageStatusEnum().notNull(),
    rawPayload: jsonb(),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_conversation_timestamp_idx").on(table.conversationId, table.timestamp),
    index("messages_lead_timestamp_idx").on(table.leadId, table.timestamp),
  ],
);

export const conversationSummaries = pgTable("conversation_summaries", {
  id: uuid().primaryKey().defaultRandom(),
  /** One living summary per lead, rewritten after each analysis. */
  leadId: uuid()
    .notNull()
    .unique()
    .references(() => leads.id, { onDelete: "cascade" }),
  summary: text().notNull(),
  customerIntent: text(),
  mainObjection: text(),
  recommendedNextAction: text(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Suggestions and follow-ups
// ---------------------------------------------------------------------------

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    conversationId: uuid().references(() => conversations.id, { onDelete: "set null" }),
    type: suggestionTypeEnum().notNull(),
    content: text().notNull(),
    reason: text(),
    /** Model confidence between 0 and 1. */
    confidence: real(),
    /** Alternative wordings (warmer, shorter, more direct, soft close). */
    variants: jsonb().$type<SuggestionVariants>(),
    /** Nothing is sent to a customer unless the seller approves it. */
    approved: boolean().notNull().default(false),
    editedContent: text(),
    sentAt: timestamptz(),
    createdAt: createdAt(),
  },
  (table) => [
    index("ai_suggestions_lead_created_idx").on(table.leadId, table.createdAt),
    check(
      "ai_suggestions_confidence_range",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
  ],
);

export const followups = pgTable(
  "followups",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    scheduledFor: timestamptz().notNull(),
    reason: text().notNull(),
    status: followupStatusEnum().notNull().default("PENDING"),
    /** Position in the no-response cadence. Null for context-driven follow-ups. */
    sequenceStep: integer(),
    aiSuggestionId: uuid().references(() => aiSuggestions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("followups_lead_idx").on(table.leadId),
    index("followups_status_scheduled_idx").on(table.status, table.scheduledFor),
  ],
);

// ---------------------------------------------------------------------------
// Audit trail and sales
// ---------------------------------------------------------------------------

export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Null when the event was produced by the system. */
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    type: leadEventTypeEnum().notNull(),
    description: text(),
    payload: jsonb(),
    createdAt: createdAt(),
  },
  (table) => [index("lead_events_lead_created_idx").on(table.leadId, table.createdAt)],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "restrict" }),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planName: text(),
    monthlyValue: numeric({ precision: 10, scale: 2 }),
    /** Snapshot of the lead origin at closing time, for attribution reports. */
    source: leadSourceEnum().notNull(),
    /** Follow-up that led to the sale, when there was one. */
    followupId: uuid().references(() => followups.id, { onDelete: "set null" }),
    notes: text(),
    closedAt: timestamptz().notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [
    index("sales_owner_closed_idx").on(table.ownerUserId, table.closedAt),
    index("sales_lead_idx").on(table.leadId),
  ],
);

// ---------------------------------------------------------------------------
// WhatsApp webhook log
// ---------------------------------------------------------------------------

export const whatsappWebhookEvents = pgTable(
  "whatsapp_webhook_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    payload: jsonb().notNull(),
    signatureValid: boolean().notNull().default(false),
    status: webhookEventStatusEnum().notNull().default("RECEIVED"),
    error: text(),
    receivedAt: timestamptz().notNull().defaultNow(),
    processedAt: timestamptz(),
  },
  (table) => [index("whatsapp_webhook_events_status_idx").on(table.status, table.receivedAt)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  sales: many(sales),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  owner: one(users, { fields: [leads.ownerUserId], references: [users.id] }),
  conversations: many(conversations),
  messages: many(messages),
  summary: one(conversationSummaries),
  suggestions: many(aiSuggestions),
  followups: many(followups),
  events: many(leadEvents),
  sales: many(sales),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  lead: one(leads, { fields: [messages.leadId], references: [leads.id] }),
}));

export const conversationSummariesRelations = relations(conversationSummaries, ({ one }) => ({
  lead: one(leads, { fields: [conversationSummaries.leadId], references: [leads.id] }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  lead: one(leads, { fields: [aiSuggestions.leadId], references: [leads.id] }),
  conversation: one(conversations, {
    fields: [aiSuggestions.conversationId],
    references: [conversations.id],
  }),
}));

export const followupsRelations = relations(followups, ({ one }) => ({
  lead: one(leads, { fields: [followups.leadId], references: [leads.id] }),
  suggestion: one(aiSuggestions, {
    fields: [followups.aiSuggestionId],
    references: [aiSuggestions.id],
  }),
}));

export const leadEventsRelations = relations(leadEvents, ({ one }) => ({
  lead: one(leads, { fields: [leadEvents.leadId], references: [leads.id] }),
  user: one(users, { fields: [leadEvents.userId], references: [users.id] }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  lead: one(leads, { fields: [sales.leadId], references: [leads.id] }),
  owner: one(users, { fields: [sales.ownerUserId], references: [users.id] }),
  followup: one(followups, { fields: [sales.followupId], references: [followups.id] }),
}));

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type Followup = typeof followups.$inferSelect;
export type LeadEvent = typeof leadEvents.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type WhatsappWebhookEvent = typeof whatsappWebhookEvents.$inferSelect;
