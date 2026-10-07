import { Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page";
import { LeadFiltersForm } from "@/components/leads/lead-filters";
import { LeadList } from "@/components/leads/lead-list";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { listLeads } from "@/lib/data/leads";
import { leadFiltersSchema } from "@/lib/validations/lead";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = PageProps<"/leads">["searchParams"];

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description="Todos os seus contatos, do primeiro oi ao fechamento."
        action={
          <Link href="/leads/novo" className={buttonStyles({ variant: "primary" })}>
            <Plus aria-hidden />
            Novo lead
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Leads searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Leads({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // A repeated query parameter arrives as an array: keep the first value.
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const filters = leadFiltersSchema.parse(single);
  const { items, total, now } = await listLeads(filters);

  return (
    <>
      <LeadFiltersForm filters={filters} />
      <p className="mt-4 mb-3 text-xs text-zinc-500" aria-live="polite">
        {items.length === total
          ? `${total} leads`
          : `${items.length} de ${total} leads com os filtros aplicados`}
      </p>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title={total === 0 ? "Nenhum lead cadastrado" : "Nenhum lead encontrado"}
            description={
              total === 0
                ? "Cadastre o primeiro contato em “Novo lead”."
                : "Ajuste a busca ou limpe os filtros para ver todos os contatos."
            }
          />
        </Card>
      ) : (
        <LeadList items={items} now={now} />
      )}
    </>
  );
}
