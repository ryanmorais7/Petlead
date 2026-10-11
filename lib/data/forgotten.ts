import "server-only";

import { followupConfig } from "@/lib/followups/config";
import { calendarDaysBetween } from "@/lib/format";
import { isActiveLead } from "@/lib/leads/contact-policy";

import { loadContext, loadOverviews, type LeadOverview } from "./source";

export type ForgottenLead = LeadOverview & { silentDays: number };

export type ForgottenLeads = {
  now: Date;
  /** Thresholds in days, each with how many leads have been silent at least that long. */
  buckets: { days: number; count: number }[];
  selectedDays: number;
  items: ForgottenLead[];
};

/**
 * Active leads without any contact for a while, longest silence first.
 * Closed, lost and do-not-contact leads never show up here.
 */
export async function getForgottenLeads(minDays?: number): Promise<ForgottenLeads> {
  const context = await loadContext();
  const thresholds = followupConfig.reactivationBucketsDays;
  const selectedDays = thresholds.find((days) => days === minDays) ?? thresholds[0];

  const silent = (await loadOverviews(context))
    .filter((item) => isActiveLead(item.lead) && item.lead.lastContactAt !== null)
    .map((item) => ({
      ...item,
      silentDays: calendarDaysBetween(item.lead.lastContactAt as Date, context.now),
    }));

  return {
    now: context.now,
    selectedDays,
    buckets: thresholds.map((days) => ({
      days,
      count: silent.filter((item) => item.silentDays >= days).length,
    })),
    items: silent
      .filter((item) => item.silentDays >= selectedDays)
      .sort((a, b) => b.silentDays - a.silentDays),
  };
}
