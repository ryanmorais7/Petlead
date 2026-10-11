import { CalendarClock, CircleCheckBig, Percent, Send, Timer, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { StatCard } from "@/components/dashboard/stat-card";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { SectionCard } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getMetrics, type CountedLabel } from "@/lib/data/metrics";
import { LEAD_SOURCE_LABELS } from "@/lib/domain/labels";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Métricas" };

export default function MetricsPage() {
  return (
    <PageContainer>
      <PageHeader title="Métricas" description="De onde vêm as suas vendas e o que trava as outras." />
      <Suspense fallback={<PageSkeleton />}>
        <Metrics />
      </Suspense>
    </PageContainer>
  );
}

/** Ranked list of labels with a bar proportional to the most frequent one. */
function RankedList({ items, empty }: { items: CountedLabel[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  const max = items[0].count;

  return (
    <ul className="space-y-3">
      {items.map(({ label, count }) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-zinc-800">{label}</span>
            <span className="shrink-0 font-semibold text-zinc-900 tabular-nums">{count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Metrics() {
  const metrics = await getMetrics();
  const { followups } = metrics;

  return (
    <div className="space-y-4">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Leads" value={String(metrics.totalLeads)} icon={Users} />
        <StatCard label="Vendas fechadas" value={String(metrics.totalSales)} icon={CircleCheckBig} />
        <StatCard
          label="Conversão"
          value={formatPercent(metrics.conversionRate)}
          icon={Percent}
          hint="Vendas sobre o total de leads"
        />
        <StatCard
          label="Tempo até fechar"
          value={
            metrics.averageDaysToClose === null
              ? "—"
              : `${metrics.averageDaysToClose.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`
          }
          icon={Timer}
          hint="Média do primeiro contato à venda"
        />
      </section>

      <SectionCard title="Por origem" description="Quantos leads cada canal trouxe e quantos viraram venda.">
        {metrics.bySource.length === 0 ? (
          <p className="text-sm text-zinc-500">Ainda não há leads cadastrados.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 pb-2 font-medium sm:px-5">Origem</th>
                  <th scope="col" className="px-3 pb-2 text-right font-medium">Leads</th>
                  <th scope="col" className="px-3 pb-2 text-right font-medium">Vendas</th>
                  <th scope="col" className="px-4 pb-2 font-medium sm:px-5">Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {metrics.bySource.map((row) => (
                  <tr key={row.source}>
                    <th scope="row" className="px-4 py-2.5 font-medium text-zinc-900 sm:px-5">
                      {LEAD_SOURCE_LABELS[row.source]}
                    </th>
                    <td className="px-3 py-2.5 text-right text-zinc-700 tabular-nums">{row.leads}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-700 tabular-nums">{row.sales}</td>
                    <td className="px-4 py-2.5 sm:px-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.min(row.conversionRate, 1) * 100}%` }}
                          />
                        </div>
                        <span className="text-zinc-900 tabular-nums">{formatPercent(row.conversionRate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Motivos de perda"
          description={`${metrics.lostLeads} ${metrics.lostLeads === 1 ? "lead perdido" : "leads perdidos"}`}
        >
          <RankedList items={metrics.lostReasons} empty="Nenhum lead marcado como perdido." />
        </SectionCard>
        <SectionCard title="Objeções mais comuns" description="Objeção principal registrada em cada lead.">
          <RankedList items={metrics.objections} empty="Nenhuma objeção registrada ainda." />
        </SectionCard>
      </div>

      <section aria-label="Follow-ups" className="grid grid-cols-3 gap-3">
        <StatCard label="Follow-ups criados" value={String(followups.created)} icon={CalendarClock} />
        <StatCard label="Follow-ups enviados" value={String(followups.sent)} icon={Send} />
        <StatCard
          label="Viraram venda"
          value={String(followups.convertedToSale)}
          icon={TrendingUp}
          hint="Vendas após um follow-up enviado"
        />
      </section>
    </div>
  );
}
