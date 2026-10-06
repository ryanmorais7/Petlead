import "server-only";

import { calendarDaysBetween } from "@/lib/format";
import { isActiveLead } from "@/lib/leads/contact-policy";
import { QUEUE_BUCKETS, type QueueBucket } from "@/lib/leads/priority";

import { buildOverviews, loadContext, type LeadOverview } from "./source";

export type DashboardStats = {
  totalLeads: number;
  hotLeads: number;
  needAttentionToday: number;
  followupsToday: number;
  unansweredConversations: number;
  closedSales: number;
  /** Closed sales divided by total leads, between 0 and 1. */
  conversionRate: number;
};

export type QueueItem = LeadOverview & { priority: NonNullable<LeadOverview["priority"]> };

export type Dashboard = {
  now: Date;
  userName: string;
  stats: DashboardStats;
  queue: Record<QueueBucket, QueueItem[]>;
};

export async function getDashboard(): Promise<Dashboard> {
  const context = await loadContext();
  const overviews = buildOverviews(context);

  const queueItems = overviews
    .filter((item): item is QueueItem => item.priority !== null)
    .sort((a, b) => b.priority.rank - a.priority.rank);

  const queue = Object.fromEntries(
    QUEUE_BUCKETS.map((bucket) => [
      bucket,
      queueItems.filter((item) => item.priority.bucket === bucket),
    ]),
  ) as Record<QueueBucket, QueueItem[]>;

  const totalLeads = overviews.length;
  const closedSales = context.data.sales.length;

  return {
    now: context.now,
    userName: context.user.name,
    queue,
    stats: {
      totalLeads,
      hotLeads: overviews.filter(
        ({ lead }) => isActiveLead(lead) && lead.temperature === "HOT",
      ).length,
      needAttentionToday: queueItems.length,
      followupsToday: overviews.filter(
        ({ nextFollowup }) =>
          nextFollowup !== null && calendarDaysBetween(nextFollowup.scheduledFor, context.now) >= 0,
      ).length,
      unansweredConversations: overviews.filter((item) => item.awaitingReply).length,
      closedSales,
      conversionRate: totalLeads === 0 ? 0 : closedSales / totalLeads,
    },
  };
}
