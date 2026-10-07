import "server-only";

import { asc, eq } from "drizzle-orm";

import { messages, type Message } from "@/db/schema";

import { loadContext, loadOverviews, type LeadOverview } from "./source";

export type InboxThread = LeadOverview & { messages: Message[] };

export type Inbox = {
  now: Date;
  /** Conversations ordered by most recent message. */
  conversations: LeadOverview[];
  /** Null when no conversation is selected or the id is unknown. */
  selected: InboxThread | null;
};

export async function getInbox(selectedLeadId?: string): Promise<Inbox> {
  const context = await loadContext();
  const overviews = await loadOverviews(context);

  const conversations = overviews
    .filter((item) => item.lastMessage !== null)
    .sort(
      (a, b) =>
        (b.lastMessage?.timestamp.getTime() ?? 0) - (a.lastMessage?.timestamp.getTime() ?? 0),
    );

  // Looking the lead up in the seller's own list also enforces ownership.
  const overview = selectedLeadId
    ? overviews.find((item) => item.lead.id === selectedLeadId)
    : undefined;

  const selected: InboxThread | null = overview
    ? {
        ...overview,
        messages: await context.db
          .select()
          .from(messages)
          .where(eq(messages.leadId, overview.lead.id))
          .orderBy(asc(messages.timestamp)),
      }
    : null;

  return { now: context.now, conversations, selected };
}
