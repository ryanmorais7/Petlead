import { z } from "zod";

import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/domain/enums";

const suggestionText = z.string().trim().min(1).max(1000);

/**
 * Structured result expected from the conversation analysis.
 * The model output is untrusted input: it is always parsed with this schema
 * before anything is stored or shown.
 */
export const conversationAnalysisSchema = z.object({
  intent: z.string().trim().min(1).max(80),
  status: z.enum(LEAD_STATUSES),
  temperature: z.enum(LEAD_TEMPERATURES),
  leadScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1200),
  mainObjection: z.string().trim().max(300).nullable().default(null),
  recommendedAction: z.string().trim().min(1).max(400),
  /** Set when the customer asked not to be contacted again. */
  doNotContact: z.boolean().default(false),
  /** Days to wait after the seller's next reply. Null when the regular cadence should apply. */
  followupInDays: z.number().int().min(0).max(120).nullable().default(null),
  /** How sure the analysis is about the recommended message, from 0 to 1. */
  confidence: z.number().min(0).max(1).default(0.5),
  suggestions: z.object({
    /** The message the seller should see first. */
    recommended: suggestionText,
    friendly: suggestionText,
    short: suggestionText,
    direct: suggestionText,
    softClose: suggestionText,
  }),
});
export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;

export const SUGGESTION_TONES = ["friendly", "short", "direct", "softClose"] as const;
export type SuggestionTone = (typeof SUGGESTION_TONES)[number];

/** Alternative wordings of one suggestion, stored next to it. */
export type SuggestionVariants = Partial<Record<SuggestionTone, string>>;

export const SUGGESTION_TONE_LABELS: Record<SuggestionTone, string> = {
  friendly: "Mais carinhosa",
  short: "Mais curta",
  direct: "Mais direta",
  softClose: "Fechamento suave",
};
