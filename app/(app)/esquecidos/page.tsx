import { Smile } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { QueueCard } from "@/components/dashboard/queue-card";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getForgottenLeads } from "@/lib/data/forgotten";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads esquecidos" };

export default function ForgottenLeadsPage({ searchParams }: PageProps<"/esquecidos">) {
  return (
    <PageContainer>
      <PageHeader
        title="Leads esquecidos"
        description="Conversas paradas há um tempo. Retome citando o que vocês falaram, sem pressão."
      />
      <Suspense fallback={<PageSkeleton />}>
        <ForgottenLeads searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function ForgottenLeads({ searchParams }: { searchParams: PageProps<"/esquecidos">["searchParams"] }) {
  const { dias } = await searchParams;
  const requested = Number(Array.isArray(dias) ? dias[0] : dias);
  const { buckets, selectedDays, items, now } = await getForgottenLeads(
    Number.isInteger(requested) ? requested : undefined,
  );

  return (
    <>
      <nav aria-label="Tempo sem contato" className="mb-5 flex flex-wrap gap-2">
        {buckets.map(({ days, count }) => {
          const selected = days === selectedDays;
          return (
            <Link
              key={days}
              href={`/esquecidos?dias=${days}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {days}+ dias
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  selected ? "bg-white/20" : "bg-zinc-100 text-zinc-600",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Smile}
            title="Ninguém esquecido por aqui"
            description={`Nenhum lead ativo está há ${selectedDays} dias ou mais sem contato.`}
          />
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <QueueCard
              key={item.lead.id}
              item={item}
              now={now}
              recommendation={`Sem contato há ${item.silentDays} dias. Reativação amigável, sem pressão.`}
            />
          ))}
        </div>
      )}
    </>
  );
}
