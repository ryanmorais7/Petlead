import "server-only";

import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";

import {
  aiSuggestions,
  followups,
  leadEvents,
  leads,
  messages,
  sales,
  type AiSuggestion,
  type Followup,
  type LeadEvent,
  type Message,
  type Sale,
} from "@/db/schema";
import type { LeadFilters } from "@/lib/validations/lead";

import { loadContext, loadOverviews, type LeadOverview } from "./source";

export type LeadList = { now: Date; total: number; items: LeadOverview[] };

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export async function listLeads(filters: LeadFilters = {}): Promise<LeadList> {
  const context = await loadContext();

  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(leads.status, filters.status));
  if (filters.temperature) conditions.push(eq(leads.temperature, filters.temperature));
  if (filters.source) conditions.push(eq(leads.source, filters.source));

  const [overviews, [totalRow]] = await Promise.all([
    loadOverviews(context, conditions.length > 0 ? and(...conditions) : undefined),
    context.db
      .select({ value: count() })
      .from(leads)
      .where(eq(leads.ownerUserId, context.user.id)),
  ]);

  // Accent-insensitive search over name, pets and phone.
  const query = filters.q ? normalize(filters.q) : null;
  const queryDigits = filters.q?.replace(/\D/g, "") ?? "";

  const items = overviews
    .filter(({ lead }) => {
      if (!query) return true;
      return (
        normalize(lead.name).includes(query) ||
        lead.petNames.some((pet) => normalize(pet).includes(query)) ||
        (queryDigits.length >= 3 && lead.phone.includes(queryDigits))
      );
    })
    .sort(
      (a, b) =>
        (b.lead.lastContactAt ?? b.lead.createdAt).getTime() -
        (a.lead.lastContactAt ?? a.lead.createdAt).getTime(),
    );

  return { now: context.now, total: totalRow?.value ?? 0, items };
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
  const { db } = context;

  const [overview] = await loadOverviews(context, eq(leads.id, leadId));
  if (!overview) return null;

  const [messageRows, followupRows, suggestionRows, eventRows, saleRows] = await Promise.all([
    db.select().from(messages).where(eq(messages.leadId, leadId)).orderBy(asc(messages.timestamp)),
    db
      .select()
      .from(followups)
      .where(eq(followups.leadId, leadId))
      .orderBy(desc(followups.scheduledFor)),
    db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.leadId, leadId))
      .orderBy(desc(aiSuggestions.createdAt)),
    db
      .select()
      .from(leadEvents)
      .where(eq(leadEvents.leadId, leadId))
      .orderBy(desc(leadEvents.createdAt)),
    db.select().from(sales).where(eq(sales.leadId, leadId)).orderBy(desc(sales.closedAt)).limit(1),
  ]);

  return {
    ...overview,
    now: context.now,
    messages: messageRows,
    followups: followupRows,
    suggestions: suggestionRows,
    events: eventRows,
    sale: saleRows[0] ?? null,
  };
}
