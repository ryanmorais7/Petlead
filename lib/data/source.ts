import "server-only";

import { and, asc, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb, type Database } from "@/db";
import {
  aiSuggestions,
  conversationSummaries,
  followups,
  leads,
  messages,
  type AiSuggestion,
  type ConversationSummary,
  type Followup,
  type Lead,
  type Message,
  type User,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { OPEN_FOLLOWUP_STATUSES } from "@/lib/domain/enums";
import { calendarDaysBetween } from "@/lib/format";
import { isActiveLead } from "@/lib/leads/contact-policy";
import { getQueuePriority, type QueuePriority } from "@/lib/leads/priority";

/**
 * Everything the screens read goes through lib/data, always scoped to the
 * signed-in seller.
 */

export type DataContext = { user: User; now: Date; db: Database };

/** A lead with the derived information most screens need. */
export type LeadOverview = {
  lead: Lead;
  summary: ConversationSummary | null;
  lastMessage: Message | null;
  /** The customer wrote last and is waiting for an answer. */
  awaitingReply: boolean;
  nextFollowup: Followup | null;
  suggestion: AiSuggestion | null;
  /** Null when the lead does not need attention today. */
  priority: QueuePriority | null;
};

export async function loadContext(): Promise<DataContext> {
  // Sales data is per seller and changes all the time: always read at request time.
  await connection();
  return { user: await getCurrentUser(), now: new Date(), db: getDb() };
}

type OverviewParts = {
  summary: ConversationSummary | null;
  lastMessage: Message | null;
  nextFollowup: Followup | null;
  suggestion: AiSuggestion | null;
};

function buildOverview(lead: Lead, parts: OverviewParts, now: Date): LeadOverview {
  // Closed, lost and do-not-contact leads never carry pending work.
  const active = isActiveLead(lead);
  const nextFollowup = active ? parts.nextFollowup : null;
  const awaitingReply = active && parts.lastMessage?.direction === "INBOUND";

  return {
    lead,
    summary: parts.summary,
    lastMessage: parts.lastMessage,
    awaitingReply,
    nextFollowup,
    suggestion: active ? parts.suggestion : null,
    priority: getQueuePriority(
      {
        status: lead.status,
        temperature: lead.temperature,
        leadScore: lead.leadScore,
        doNotContact: lead.doNotContact,
        lastContactAt: lead.lastContactAt,
        awaitingReply,
        nextFollowup: nextFollowup && {
          scheduledFor: nextFollowup.scheduledFor,
          reason: nextFollowup.reason,
          // The seller scheduled it knowing about the customer's last message.
          setAfterLastMessage:
            parts.lastMessage === null || nextFollowup.updatedAt > parts.lastMessage.timestamp,
        },
      },
      now,
    ),
  };
}

function firstByLead<T extends { leadId: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.leadId)) map.set(row.leadId, row);
  }
  return map;
}

/** Loads the seller's leads, optionally filtered, with their derived information. */
export async function loadOverviews(
  { db, user, now }: DataContext,
  where?: SQL,
): Promise<LeadOverview[]> {
  const leadRows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.ownerUserId, user.id), where));
  if (leadRows.length === 0) return [];

  const ids = leadRows.map((lead) => lead.id);
  const [summaryRows, lastMessages, openFollowups, pendingSuggestions] = await Promise.all([
    db.select().from(conversationSummaries).where(inArray(conversationSummaries.leadId, ids)),
    db
      .selectDistinctOn([messages.leadId])
      .from(messages)
      .where(inArray(messages.leadId, ids))
      .orderBy(messages.leadId, desc(messages.timestamp)),
    db
      .select()
      .from(followups)
      .where(
        and(inArray(followups.leadId, ids), inArray(followups.status, [...OPEN_FOLLOWUP_STATUSES])),
      )
      .orderBy(asc(followups.scheduledFor)),
    db
      .select()
      .from(aiSuggestions)
      .where(and(inArray(aiSuggestions.leadId, ids), isNull(aiSuggestions.sentAt)))
      .orderBy(desc(aiSuggestions.createdAt)),
  ]);

  const summaryByLead = firstByLead(summaryRows);
  const messageByLead = firstByLead(lastMessages);
  const followupByLead = firstByLead(openFollowups);
  const suggestionByLead = firstByLead(pendingSuggestions);

  return leadRows.map((lead) =>
    buildOverview(
      lead,
      {
        summary: summaryByLead.get(lead.id) ?? null,
        lastMessage: messageByLead.get(lead.id) ?? null,
        nextFollowup: followupByLead.get(lead.id) ?? null,
        suggestion: suggestionByLead.get(lead.id) ?? null,
      },
      now,
    ),
  );
}

/** True when the follow-up is due today or overdue. */
export function isDueToday(followup: Followup, now: Date): boolean {
  return calendarDaysBetween(followup.scheduledFor, now) >= 0;
}
