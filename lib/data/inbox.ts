import "server-only";

import type { Message } from "@/db/schema";
import type { SuggestionTones } from "@/lib/mock/dataset";

import { buildOverview, buildOverviews, loadContext, type LeadOverview } from "./source";

export type InboxThread = LeadOverview & {
  messages: Message[];
  /** Alternative wordings of the current suggestion. */
  tones: SuggestionTones;
};

export type Inbox = {
  now: Date;
  /** Conversations ordered by most recent message. */
  conversations: LeadOverview[];
  /** Null when no conversation is selected or the id is unknown. */
  selected: InboxThread | null;
};

export async function getInbox(selectedLeadId?: string): Promise<Inbox> {
  const context = await loadContext();

  const conversations = buildOverviews(context)
    .filter((item) => item.lastMessage !== null)
    .sort(
      (a, b) =>
        (b.lastMessage?.timestamp.getTime() ?? 0) - (a.lastMessage?.timestamp.getTime() ?? 0),
    );

  const lead = selectedLeadId
    ? context.data.leads.find((item) => item.id === selectedLeadId)
    : undefined;

  const selected: InboxThread | null = lead
    ? {
        ...buildOverview(lead, context),
        messages: context.data.messages
          .filter((message) => message.leadId === lead.id)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
        tones: context.data.suggestionTones[lead.id] ?? {},
      }
    : null;

  return { now: context.now, conversations, selected };
}
