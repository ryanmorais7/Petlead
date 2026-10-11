import "server-only";

import { eq, inArray } from "drizzle-orm";

import { followups, leads, sales } from "@/db/schema";
import { LEAD_SOURCES, type LeadSource } from "@/lib/domain/enums";

import { loadContext } from "./source";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SourceMetrics = {
  source: LeadSource;
  leads: number;
  sales: number;
  /** Sales divided by leads of this origin, between 0 and 1. */
  conversionRate: number;
};

export type CountedLabel = { label: string; count: number };

export type Metrics = {
  totalLeads: number;
  totalSales: number;
  conversionRate: number;
  /** Average days between the first contact and the sale. Null without sales. */
  averageDaysToClose: number | null;
  lostLeads: number;
  bySource: SourceMetrics[];
  lostReasons: CountedLabel[];
  objections: CountedLabel[];
  followups: {
    created: number;
    sent: number;
    /** Sales credited to a follow-up that was actually sent. */
    convertedToSale: number;
  };
};

/** Groups free-text labels ignoring case and surrounding spaces, most frequent first. */
function countLabels(values: (string | null)[]): CountedLabel[] {
  const counts = new Map<string, CountedLabel>();
  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("pt-BR");
    const entry = counts.get(key) ?? { label, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export async function getMetrics(): Promise<Metrics> {
  const { db, user } = await loadContext();

  const [leadRows, saleRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        source: leads.source,
        status: leads.status,
        createdAt: leads.createdAt,
        lostReason: leads.lostReason,
        mainObjection: leads.mainObjection,
      })
      .from(leads)
      .where(eq(leads.ownerUserId, user.id)),
    db
      .select({
        leadId: sales.leadId,
        source: sales.source,
        closedAt: sales.closedAt,
        followupId: sales.followupId,
      })
      .from(sales)
      .where(eq(sales.ownerUserId, user.id)),
  ]);

  const leadIds = leadRows.map((lead) => lead.id);
  const followupRows =
    leadIds.length > 0
      ? await db
          .select({ status: followups.status })
          .from(followups)
          .where(inArray(followups.leadId, leadIds))
      : [];

  const createdAtByLead = new Map(leadRows.map((lead) => [lead.id, lead.createdAt]));
  const daysToClose = saleRows.flatMap((sale) => {
    const createdAt = createdAtByLead.get(sale.leadId);
    return createdAt ? [Math.max(0, (sale.closedAt.getTime() - createdAt.getTime()) / DAY_MS)] : [];
  });

  const lost = leadRows.filter((lead) => lead.status === "LOST");
  const totalLeads = leadRows.length;
  const totalSales = saleRows.length;

  return {
    totalLeads,
    totalSales,
    conversionRate: totalLeads === 0 ? 0 : totalSales / totalLeads,
    averageDaysToClose:
      daysToClose.length === 0
        ? null
        : daysToClose.reduce((total, days) => total + days, 0) / daysToClose.length,
    lostLeads: lost.length,
    bySource: LEAD_SOURCES.map((source) => {
      const sourceLeads = leadRows.filter((lead) => lead.source === source).length;
      // The sale keeps the origin the lead had when it closed.
      const sourceSales = saleRows.filter((sale) => sale.source === source).length;
      return {
        source,
        leads: sourceLeads,
        sales: sourceSales,
        conversionRate: sourceLeads === 0 ? 0 : sourceSales / sourceLeads,
      };
    })
      .filter((row) => row.leads > 0 || row.sales > 0)
      .sort((a, b) => b.sales - a.sales || b.leads - a.leads),
    lostReasons: countLabels(lost.map((lead) => lead.lostReason ?? "Motivo não informado")),
    objections: countLabels(leadRows.map((lead) => lead.mainObjection)),
    followups: {
      created: followupRows.length,
      sent: followupRows.filter((followup) => followup.status === "SENT").length,
      convertedToSale: saleRows.filter((sale) => sale.followupId !== null).length,
    },
  };
}
