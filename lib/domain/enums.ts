/**
 * Single source of truth for every enumerated value in the domain.
 * The database schema, the Zod validations and the UI all derive from these lists.
 */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "HOT",
  "THINKING",
  "WAITING_FAMILY",
  "COMPARING_COMPETITOR",
  "WAITING_DOCUMENTS",
  "WAITING_PAYMENT",
  "NO_RESPONSE",
  "FOLLOW_UP",
  "READY_TO_CLOSE",
  "CLOSED",
  "LOST",
  "DO_NOT_CONTACT",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEMPERATURES = ["HOT", "WARM", "COLD"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const LEAD_SOURCES = [
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "INDICACAO",
  "PANFLETO",
  "INFLUENCIADOR",
  "CONDOMINIO",
  "OUTRO",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const USER_ROLES = ["ADMIN", "SELLER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MESSAGE_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_TYPES = ["TEXT", "AUDIO", "IMAGE", "DOCUMENT", "OTHER"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_STATUSES = [
  "RECEIVED",
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const SUGGESTION_TYPES = ["REPLY", "FOLLOW_UP", "REACTIVATION", "CLOSING"] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const FOLLOWUP_STATUSES = [
  "PENDING",
  "READY",
  "APPROVED",
  "SENT",
  "CANCELLED",
  "SKIPPED",
] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const LEAD_EVENT_TYPES = [
  "LEAD_CREATED",
  "MESSAGE_RECEIVED",
  "MESSAGE_SENT",
  "STATUS_CHANGED",
  "FOLLOWUP_CREATED",
  "FOLLOWUP_SENT",
  "SALE_CLOSED",
  "DO_NOT_CONTACT_SET",
] as const;
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number];

export const WEBHOOK_EVENT_STATUSES = ["RECEIVED", "PROCESSED", "IGNORED", "FAILED"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

/** Statuses in which the lead must never enter a contact queue. */
export const TERMINAL_LEAD_STATUSES = [
  "CLOSED",
  "LOST",
  "DO_NOT_CONTACT",
] as const satisfies readonly LeadStatus[];

/** Follow-ups that are still waiting for an action from the seller. */
export const OPEN_FOLLOWUP_STATUSES = [
  "PENDING",
  "READY",
  "APPROVED",
] as const satisfies readonly FollowupStatus[];
