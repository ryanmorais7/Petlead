import {
  BellRing,
  CalendarClock,
  CircleCheckBig,
  Flame,
  MessageCircleQuestion,
  PartyPopper,
  Percent,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { QueueSection } from "@/components/dashboard/queue-section";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/data/dashboard";
import { firstName, formatPercent, formatWeekday } from "@/lib/format";
import { QUEUE_BUCKETS } from "@/lib/leads/priority";

export const metadata: Metadata = { title: "Hoje" };

export default function DashboardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </PageContainer>
  );
}

async function Dashboard() {
  const { now, userName, stats, queue } = await getDashboard();
  const queueSize = stats.needAttentionToday;

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName(userName)}`}
        description={
          queueSize === 0
            ? `${formatWeekday(now)}. Ninguém precisa de você agora.`
            : `${formatWeekday(now)}. ${queueSize} ${queueSize === 1 ? "pessoa precisa" : "pessoas precisam"} da sua atenção hoje.`
        }
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Precisam de atenção hoje"
          value={String(stats.needAttentionToday)}
          icon={BellRing}
          emphasis
          className="col-span-2 md:col-span-1"
        />
        <StatCard
          label="Conversas não respondidas"
          value={String(stats.unansweredConversations)}
          icon={MessageCircleQuestion}
        />
        <StatCard label="Follow-ups de hoje" value={String(stats.followupsToday)} icon={CalendarClock} />
        <StatCard label="Leads quentes" value={String(stats.hotLeads)} icon={Flame} />
        <StatCard label="Leads totais" value={String(stats.totalLeads)} icon={Users} />
        <StatCard label="Vendas fechadas" value={String(stats.closedSales)} icon={CircleCheckBig} />
        <StatCard
          label="Taxa de conversão"
          value={formatPercent(stats.conversionRate)}
          icon={Percent}
          hint="Vendas sobre o total de leads"
          className="md:col-span-2"
        />
      </section>

      <section aria-labelledby="queue-title" className="mt-8">
        <h2 id="queue-title" className="text-lg font-semibold tracking-tight text-zinc-900">
          Minha fila de hoje
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Quem chamar, em ordem de prioridade. Você revisa cada mensagem antes de enviar.
        </p>

        {queueSize === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={PartyPopper}
              title="Fila zerada"
              description="Nenhum cliente esperando e nenhum follow-up para hoje."
            />
          </Card>
        ) : (
          <div className="mt-5 space-y-8">
            {QUEUE_BUCKETS.map((bucket) => (
              <QueueSection key={bucket} bucket={bucket} items={queue[bucket]} now={now} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
