import "server-only";

import type { AiSuggestion, Followup, LeadEvent, Message, Sale } from "@/db/schema";
import type { LeadFilters } from "@/lib/validations/lead";

import { buildOverview, buildOverviews, loadContext, type LeadOverview } from "./source";

export type LeadList = { now: Date; total: number; items: LeadOverview[] };

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export async function listLeads(filters: LeadFilters = {}): Promise<LeadList> {
  const context = await loadContext();
  const overviews = buildOverviews(context);
  const query = filters.q ? normalize(filters.q) : null;
  const queryDigits = filters.q?.replace(/\D/g, "") ?? "";

  const items = overviews
    .filter(({ lead }) => {
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.temperature && lead.temperature !== filters.temperature) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (!query) return true;
      return (
        normalize(lead.name).includes(query) ||
        lead.petNames.some((pet) => normalize(pet).includes(query)) ||
        (queryDigits.length >= 3 && lead.phone.includes(queryDigits))
      );
    })
    .sort(
      (a, b) =>
        (b.lead.lastContactAt?.getTime() ?? 0) - (a.lead.lastContactAt?.getTime() ?? 0),
    );

  return { now: context.now, total: overviews.length, items };
}

export type LeadProfile = LeadOverview & {
  now: Date;
  messages: Message[];
  followups: Followup[];
  suggestions: AiSuggestion[];
  events: LeadEvent[];
  sale: Sale | null;
};

/** Returns null when the lead does not exist or belongs to another seller. */
export async function getLeadProfile(leadId: string): Promise<LeadProfile | null> {
  const context = await loadContext();
  const lead = context.data.leads.find((item) => item.id === leadId);
  if (!lead) return null;

  const ofLead = <T extends { leadId: string }>(rows: T[]) =>
    rows.filter((row) => row.leadId === lead.id);

  return {
    ...buildOverview(lead, context),
    now: context.now,
    messages: ofLead(context.data.messages).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    ),
    followups: ofLead(context.data.followups).sort(
      (a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime(),
    ),
    suggestions: ofLead(context.data.suggestions).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
    events: ofLead(context.data.events).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
    sale: ofLead(context.data.sales)[0] ?? null,
  };
}
