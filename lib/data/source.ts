import "server-only";

import { connection } from "next/server";

import type {
  AiSuggestion,
  ConversationSummary,
  Followup,
  Lead,
  Message,
  User,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { OPEN_FOLLOWUP_STATUSES, type FollowupStatus } from "@/lib/domain/enums";
import { isActiveLead } from "@/lib/leads/contact-policy";
import { getQueuePriority, type QueuePriority } from "@/lib/leads/priority";
import { buildMockDataset, type Dataset } from "@/lib/mock/dataset";

/**
 * Everything the screens read goes through lib/data. Today the source is the
 * demonstration dataset; replacing it with Drizzle queries will not change the
 * pages, only the functions of this folder.
 */

export type DataContext = { user: User; now: Date; data: Dataset };

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

  const user = await getCurrentUser();
  const now = new Date();
  const data = buildMockDataset(now);
  const ownLeadIds = new Set(
    data.leads.filter((lead) => lead.ownerUserId === user.id).map((lead) => lead.id),
  );
  const own = <T extends { leadId: string }>(rows: T[]) =>
    rows.filter((row) => ownLeadIds.has(row.leadId));

  return {
    user,
    now,
    data: {
      ...data,
      leads: data.leads.filter((lead) => ownLeadIds.has(lead.id)),
      conversations: own(data.conversations),
      messages: own(data.messages),
      summaries: own(data.summaries),
      suggestions: own(data.suggestions),
      followups: own(data.followups),
      events: own(data.events),
      sales: own(data.sales),
    },
  };
}

function isOpenFollowup(followup: Followup): boolean {
  return (OPEN_FOLLOWUP_STATUSES as readonly FollowupStatus[]).includes(followup.status);
}

export function buildOverview(lead: Lead, { data, now }: DataContext): LeadOverview {
  const messages = data.messages
    .filter((message) => message.leadId === lead.id)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const lastMessage = messages.at(-1) ?? null;
  const active = isActiveLead(lead);

  const nextFollowup = active
    ? (data.followups
        .filter((followup) => followup.leadId === lead.id && isOpenFollowup(followup))
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0] ?? null)
    : null;

  const suggestion = active
    ? (data.suggestions
        .filter((item) => item.leadId === lead.id && item.sentAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null)
    : null;

  const awaitingReply = active && lastMessage?.direction === "INBOUND";

  return {
    lead,
    summary: data.summaries.find((summary) => summary.leadId === lead.id) ?? null,
    lastMessage,
    awaitingReply,
    nextFollowup,
    suggestion,
    priority: getQueuePriority(
      {
        status: lead.status,
        temperature: lead.temperature,
        leadScore: lead.leadScore,
        doNotContact: lead.doNotContact,
        lastContactAt: lead.lastContactAt,
        awaitingReply,
        nextFollowup,
      },
      now,
    ),
  };
}

export function buildOverviews(context: DataContext): LeadOverview[] {
  return context.data.leads.map((lead) => buildOverview(lead, context));
}
