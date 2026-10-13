import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  aiSuggestions,
  conversationSummaries,
  conversations,
  followups,
  leadEvents,
  leads,
  messages,
  users,
  type Lead,
} from "@/db/schema";
import type { DbClient } from "@/db/types";
import { OPEN_FOLLOWUP_STATUSES, type LeadStatus, type SuggestionType } from "@/lib/domain/enums";
import { LEAD_STATUS_LABELS } from "@/lib/domain/labels";
import { AppError } from "@/lib/errors";
import { followupConfig } from "@/lib/followups/config";
import { APP_TIME_ZONE, calendarDaysBetween, firstName } from "@/lib/format";
import { isActiveLead, isContactBlocked } from "@/lib/leads/contact-policy";
import { conversationAnalysisSchema, type ConversationAnalysis } from "@/lib/validations/analysis";

import type { ConversationContext, SuggestionProvider } from "./provider";

/** How much of the conversation is sent for analysis. */
const MAX_MESSAGES = 40;
const MAX_PREVIOUS_SUGGESTIONS = 4;

/** Decisions that belong to the seller: the analysis may never make them. */
const SELLER_ONLY_STATUSES: readonly LeadStatus[] = ["CLOSED", "LOST"];
const CLOSING_STATUSES: readonly LeadStatus[] = ["READY_TO_CLOSE", "WAITING_PAYMENT", "WAITING_DOCUMENTS"];

export type AnalysisOutcome = "updated" | "blocked" | "summary_only";

export type AnalyzeInput = {
  leadId: string;
  /** When given, the lead must belong to this seller. */
  ownerUserId?: string;
  instruction?: string;
};

export type AnalyzeDeps = { provider: SuggestionProvider; now?: () => Date };

function suggestionType(status: LeadStatus, awaitingReply: boolean, silentDays: number | null): SuggestionType {
  if (CLOSING_STATUSES.includes(status)) return "CLOSING";
  if (awaitingReply) return "REPLY";
  if (silentDays !== null && silentDays >= followupConfig.reactivationAfterDays) return "REACTIVATION";
  return "FOLLOW_UP";
}

/**
 * Reads a lead's conversation, asks the provider for an analysis and applies
 * it: summary, temperature, score, objection, status and a fresh suggestion
 * for the seller to review.
 *
 * Nothing is sent to the customer here. The model's answer is validated before
 * use and can never close a sale, mark a lead as lost or reopen a blocked one.
 */
export async function analyzeLeadConversation(
  db: DbClient,
  input: AnalyzeInput,
  deps: AnalyzeDeps,
): Promise<AnalysisOutcome> {
  const now = deps.now?.() ?? new Date();

  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(eq(leads.id, input.leadId), input.ownerUserId ? eq(leads.ownerUserId, input.ownerUserId) : undefined),
    )
    .limit(1);
  if (!lead) throw new AppError("NOT_FOUND", `Lead ${input.leadId} not found`);

  const [recentMessages, [summary], [owner], previous] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.leadId, lead.id))
      .orderBy(desc(messages.timestamp))
      .limit(MAX_MESSAGES),
    db.select().from(conversationSummaries).where(eq(conversationSummaries.leadId, lead.id)).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, lead.ownerUserId)).limit(1),
    db
      .select({ content: aiSuggestions.content, editedContent: aiSuggestions.editedContent })
      .from(aiSuggestions)
      .where(eq(aiSuggestions.leadId, lead.id))
      .orderBy(desc(aiSuggestions.createdAt))
      .limit(MAX_PREVIOUS_SUGGESTIONS),
  ]);

  const thread = recentMessages.reverse();
  const awaitingReply = thread.at(-1)?.direction === "INBOUND";
  const silentDays = lead.lastContactAt ? calendarDaysBetween(lead.lastContactAt, now) : null;

  const context: ConversationContext = {
    now: now.toISOString(),
    weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: APP_TIME_ZONE }).format(now),
    seller: { firstName: firstName(owner?.name ?? "") },
    lead: {
      name: lead.name,
      source: lead.source,
      status: lead.status,
      temperature: lead.temperature,
      leadScore: lead.leadScore,
      petCount: lead.petCount,
      petNames: lead.petNames,
      planInterest: lead.planInterest,
      mainObjection: lead.mainObjection,
      notes: lead.notes,
      daysSinceLastContact: silentDays,
      awaitingReply,
    },
    messages: thread.map((message) => ({
      direction: message.direction,
      type: message.type,
      text: message.text,
      at: message.timestamp.toISOString(),
    })),
    previousSummary: summary?.summary ?? null,
    previousSuggestions: previous.map((item) => item.editedContent ?? item.content),
    instruction: input.instruction?.trim() || null,
  };

  // Never trust the model: anything that does not match the schema is rejected whole.
  const parsed = conversationAnalysisSchema.safeParse(await deps.provider.analyzeConversation(context));
  if (!parsed.success) {
    throw new AppError("INTEGRATION", "The analysis did not match the expected format", {
      cause: parsed.error,
    });
  }

  return applyAnalysis(db, { lead, analysis: parsed.data, awaitingReply, silentDays, now });
}

async function applyAnalysis(
  db: DbClient,
  input: {
    lead: Lead;
    analysis: ConversationAnalysis;
    awaitingReply: boolean;
    silentDays: number | null;
    now: Date;
  },
): Promise<AnalysisOutcome> {
  const { lead, analysis, awaitingReply, silentDays, now } = input;
  const active = isActiveLead(lead);
  const asksToStop = analysis.doNotContact || analysis.status === "DO_NOT_CONTACT";
  const keepsPlan = active && !asksToStop;

  const summaryValues = {
    summary: analysis.summary,
    customerIntent: analysis.intent,
    mainObjection: analysis.mainObjection,
    recommendedNextAction: analysis.recommendedAction,
    followupInDays: keepsPlan ? analysis.followupInDays : null,
    followupReason: keepsPlan && analysis.followupInDays !== null ? analysis.recommendedAction : null,
    updatedAt: now,
  };
  await db
    .insert(conversationSummaries)
    .values({ leadId: lead.id, ...summaryValues })
    .onConflictDoUpdate({ target: conversationSummaries.leadId, set: summaryValues });

  // A new analysis replaces whatever was waiting for review.
  await db
    .delete(aiSuggestions)
    .where(and(eq(aiSuggestions.leadId, lead.id), isNull(aiSuggestions.sentAt)));

  if (asksToStop && !isContactBlocked(lead)) {
    await db
      .update(leads)
      .set({ status: "DO_NOT_CONTACT", doNotContact: true, nextFollowupAt: null, temperature: "COLD", leadScore: 0 })
      .where(eq(leads.id, lead.id));
    await db
      .update(followups)
      .set({ status: "CANCELLED" })
      .where(and(eq(followups.leadId, lead.id), inArray(followups.status, [...OPEN_FOLLOWUP_STATUSES])));
    await db.insert(leadEvents).values({
      leadId: lead.id,
      type: "DO_NOT_CONTACT_SET",
      description: "Cliente pediu para não receber mais mensagens.",
      createdAt: now,
    });
    return "blocked";
  }

  // Closed, lost and blocked leads keep their status; only the summary is refreshed.
  if (!active) return asksToStop ? "blocked" : "summary_only";

  const status = SELLER_ONLY_STATUSES.includes(analysis.status) ? lead.status : analysis.status;
  await db
    .update(leads)
    .set({
      status,
      temperature: analysis.temperature,
      leadScore: analysis.leadScore,
      mainObjection: analysis.mainObjection,
    })
    .where(eq(leads.id, lead.id));

  if (status !== lead.status) {
    await db.insert(leadEvents).values({
      leadId: lead.id,
      type: "STATUS_CHANGED",
      description: `Status alterado para "${LEAD_STATUS_LABELS[status]}".`,
      createdAt: now,
    });
  }

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .limit(1);

  const { recommended, ...variants } = analysis.suggestions;
  await db.insert(aiSuggestions).values({
    leadId: lead.id,
    conversationId: conversation?.id ?? null,
    type: suggestionType(status, awaitingReply, silentDays),
    content: recommended,
    reason: analysis.recommendedAction,
    confidence: analysis.confidence,
    variants,
    createdAt: now,
  });

  return "updated";
}
