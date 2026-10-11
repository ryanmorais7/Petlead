import { and, asc, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";

import { conversationSummaries, followups, leadEvents, leads, type Lead } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { OPEN_FOLLOWUP_STATUSES } from "@/lib/domain/enums";
import { calendarDaysBetween } from "@/lib/format";
import { isActiveLead } from "@/lib/leads/contact-policy";

import { followupConfig } from "./config";

/**
 * Follow-up engine. It never sends anything: it only decides when a lead
 * should come back to the seller's queue, reacting to two events.
 *
 * - The customer wrote: whatever was scheduled is cancelled, because the
 *   conversation is alive again and the seller has to answer.
 * - The seller wrote: the follow-up that was due is marked as sent, and the
 *   next one is scheduled, either from the conversation context or from the
 *   increasingly spaced no-response cadence.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = [...OPEN_FOLLOWUP_STATUSES];

export type FollowupPlan = { inDays: number; reason: string; sequenceStep: number | null };

/**
 * Decides the next follow-up after a message from the seller.
 * Pure: everything it needs is passed in.
 *
 * @param contextual plan taken from the conversation, when it is still current
 * @param lastCadenceStep last no-response attempt since the customer last wrote
 */
export function planNextFollowup(input: {
  contextual: { inDays: number; reason: string | null } | null;
  lastCadenceStep: number | null;
  cadenceDays?: readonly number[];
}): FollowupPlan | null {
  const cadence = input.cadenceDays ?? followupConfig.noResponseCadenceDays;

  // What the customer said ("me chama semana que vem") always wins over the cadence.
  if (input.contextual) {
    return {
      inDays: input.contextual.inDays,
      reason: input.contextual.reason ?? "Retomar a conversa conforme combinado.",
      sequenceStep: null,
    };
  }

  const step = input.lastCadenceStep === null ? 0 : input.lastCadenceStep + 1;
  // Cadence exhausted: stop insisting. The lead shows up later only as a reactivation.
  if (step >= cadence.length) return null;

  return {
    inDays: cadence[step],
    reason: `Sem resposta do cliente. Tentativa ${step + 1} de ${cadence.length}.`,
    sequenceStep: step,
  };
}

/** The customer wrote: nothing scheduled before this message still makes sense. */
export async function onInboundMessage(db: DbClient, leadId: string): Promise<void> {
  const cancelled = await db
    .update(followups)
    .set({ status: "CANCELLED" })
    .where(and(eq(followups.leadId, leadId), inArray(followups.status, OPEN_STATUSES)))
    .returning({ id: followups.id });

  if (cancelled.length > 0) {
    await db.update(leads).set({ nextFollowupAt: null }).where(eq(leads.id, leadId));
  }
}

/**
 * The seller wrote. Marks the due follow-up as sent and schedules the next one.
 *
 * @param lastInboundAt when the customer last wrote, to tell which plans and
 *                      cadence attempts belong to the current silence
 */
export async function onOutboundMessage(
  db: DbClient,
  input: { lead: Lead; userId: string; lastInboundAt: Date | null; now: Date },
): Promise<void> {
  const { lead, userId, lastInboundAt, now } = input;
  // Closed, lost and do-not-contact leads never get a follow-up.
  if (!isActiveLead(lead)) return;

  const open = await db
    .select()
    .from(followups)
    .where(and(eq(followups.leadId, lead.id), inArray(followups.status, OPEN_STATUSES)))
    .orderBy(asc(followups.scheduledFor));

  // This message is the follow-up that was due.
  const due = open.filter((followup) => calendarDaysBetween(followup.scheduledFor, now) >= 0);
  if (due.length > 0) {
    await db
      .update(followups)
      .set({ status: "SENT" })
      .where(inArray(followups.id, due.map((followup) => followup.id)));
    await db.insert(leadEvents).values({
      leadId: lead.id,
      userId,
      type: "FOLLOWUP_SENT",
      description: due[0].reason,
      createdAt: now,
    });
  }

  // A follow-up still scheduled for later (the seller postponed it, or the
  // customer asked for a date) stays as it is.
  const stillOpen = open.filter((followup) => !due.includes(followup));
  if (stillOpen.length > 0) {
    await db.update(leads).set({ nextFollowupAt: stillOpen[0].scheduledFor }).where(eq(leads.id, lead.id));
    return;
  }

  const [summary] = await db
    .select({
      inDays: conversationSummaries.followupInDays,
      reason: conversationSummaries.followupReason,
      updatedAt: conversationSummaries.updatedAt,
    })
    .from(conversationSummaries)
    .where(eq(conversationSummaries.leadId, lead.id))
    .limit(1);

  // A plan only counts if it was made after the customer's last message.
  const planIsCurrent =
    summary?.inDays != null && (lastInboundAt === null || summary.updatedAt >= lastInboundAt);

  const [lastAttempt] = await db
    .select({ step: followups.sequenceStep })
    .from(followups)
    .where(
      and(
        eq(followups.leadId, lead.id),
        isNotNull(followups.sequenceStep),
        lastInboundAt ? gt(followups.createdAt, lastInboundAt) : undefined,
      ),
    )
    .orderBy(desc(followups.createdAt))
    .limit(1);

  const plan = planNextFollowup({
    contextual: planIsCurrent && summary?.inDays != null ? { inDays: summary.inDays, reason: summary.reason } : null,
    lastCadenceStep: lastAttempt?.step ?? null,
  });

  if (!plan) {
    await db.update(leads).set({ nextFollowupAt: null }).where(eq(leads.id, lead.id));
    return;
  }

  const scheduledFor = new Date(now.getTime() + plan.inDays * DAY_MS);
  await db.insert(followups).values({
    leadId: lead.id,
    scheduledFor,
    reason: plan.reason,
    status: "PENDING",
    sequenceStep: plan.sequenceStep,
    createdAt: now,
    updatedAt: now,
  });
  await db.update(leads).set({ nextFollowupAt: scheduledFor }).where(eq(leads.id, lead.id));

  // The plan was used: the next silence falls back to the regular cadence.
  if (planIsCurrent) {
    await db
      .update(conversationSummaries)
      .set({ followupInDays: null, followupReason: null, updatedAt: summary.updatedAt })
      .where(eq(conversationSummaries.leadId, lead.id));
  }

  await db.insert(leadEvents).values({
    leadId: lead.id,
    type: "FOLLOWUP_CREATED",
    description: plan.reason,
    createdAt: now,
  });
}
