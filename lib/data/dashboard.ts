import "server-only";

import { count, eq } from "drizzle-orm";

import { sales } from "@/db/schema";
import { isActiveLead } from "@/lib/leads/contact-policy";
import { QUEUE_BUCKETS, type QueueBucket } from "@/lib/leads/priority";

import { isDueToday, loadContext, loadOverviews, type LeadOverview } from "./source";

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
  const [overviews, [salesCount]] = await Promise.all([
    loadOverviews(context),
    context.db
      .select({ value: count() })
      .from(sales)
      .where(eq(sales.ownerUserId, context.user.id)),
  ]);

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
  const closedSales = salesCount?.value ?? 0;

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
        ({ nextFollowup }) => nextFollowup !== null && isDueToday(nextFollowup, context.now),
      ).length,
      unansweredConversations: overviews.filter((item) => item.awaitingReply).length,
      closedSales,
      conversionRate: totalLeads === 0 ? 0 : closedSales / totalLeads,
    },
  };
}
