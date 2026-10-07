import type { LeadStatus, LeadTemperature } from "@/lib/domain/enums";
import { followupConfig } from "@/lib/followups/config";
import { calendarDaysBetween } from "@/lib/format";

import { isActiveLead } from "./contact-policy";
import { scoringConfig } from "./scoring";

export const QUEUE_BUCKETS = ["HIGH", "MEDIUM", "REACTIVATION"] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

export type QueuePriority = {
  bucket: QueueBucket;
  /** Short explanation shown to the seller. */
  reason: string;
  /** Higher comes first. */
  rank: number;
};

type PriorityInput = {
  status: LeadStatus;
  temperature: LeadTemperature;
  leadScore: number;
  doNotContact: boolean;
  lastContactAt: Date | null;
  /** The customer wrote last and is still waiting for an answer. */
  awaitingReply: boolean;
  /** Earliest open follow-up of the lead, if any. */
  nextFollowup: {
    scheduledFor: Date;
    reason: string;
    /** Scheduled or postponed after the customer's last message. */
    setAfterLastMessage: boolean;
  } | null;
};

const BUCKET_WEIGHT: Record<QueueBucket, number> = { HIGH: 3000, MEDIUM: 2000, REACTIVATION: 1000 };

const CLOSING_STATUSES: readonly LeadStatus[] = [
  "READY_TO_CLOSE",
  "WAITING_PAYMENT",
  "WAITING_DOCUMENTS",
];

function build(bucket: QueueBucket, reason: string, score: number): QueuePriority {
  return { bucket, reason, rank: BUCKET_WEIGHT[bucket] + score };
}

/**
 * Decides whether a lead belongs in today's queue and how urgent it is.
 * Returns null when the seller has nothing to do for this lead today.
 */
export function getQueuePriority(lead: PriorityInput, now: Date): QueuePriority | null {
  if (!isActiveLead(lead)) return null;

  const dueToday =
    lead.nextFollowup !== null &&
    calendarDaysBetween(lead.nextFollowup.scheduledFor, now) >= 0;
  // The seller already saw the last message and chose a later date for it.
  const postponed =
    lead.nextFollowup !== null && !dueToday && lead.nextFollowup.setAfterLastMessage;

  const silentDays = lead.lastContactAt ? calendarDaysBetween(lead.lastContactAt, now) : 0;
  // An unanswered message from weeks ago is no longer urgent: it is a reactivation.
  const stale = silentDays >= followupConfig.reactivationAfterDays;

  if (lead.awaitingReply && !postponed && !stale) {
    return build("HIGH", "Cliente aguardando a sua resposta", lead.leadScore);
  }

  if (lead.nextFollowup) {
    // A follow-up scheduled for later means the customer asked for time: do not insist.
    if (!dueToday) return null;

    const urgent =
      lead.temperature === "HOT" ||
      lead.leadScore >= scoringConfig.hotThreshold ||
      CLOSING_STATUSES.includes(lead.status);
    return build(urgent ? "HIGH" : "MEDIUM", lead.nextFollowup.reason, lead.leadScore);
  }

  if (!lead.lastContactAt) {
    return build("MEDIUM", "Lead novo, ainda sem nenhum contato.", lead.leadScore);
  }

  if (stale) {
    return build(
      "REACTIVATION",
      `Sem contato há ${silentDays} dias. Reativação amigável, sem pressão.`,
      lead.leadScore,
    );
  }

  return null;
}
