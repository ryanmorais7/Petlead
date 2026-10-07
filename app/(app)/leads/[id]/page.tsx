import { ArrowLeft, Ban, MessageCircle, MessagesSquare, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { MessageThread } from "@/components/conversation/message-thread";
import { PageContainer } from "@/components/layout/page";
import { LeadActions } from "@/components/leads/lead-actions";
import { StatusBadge, TemperatureBadge } from "@/components/leads/lead-badges";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getLeadProfile } from "@/lib/data/leads";
import {
  FOLLOWUP_STATUS_LABELS,
  FOLLOWUP_STATUS_TONES,
  LEAD_SOURCE_LABELS,
  SUGGESTION_TYPE_LABELS,
} from "@/lib/domain/labels";
import {
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatPets,
  formatPhone,
  formatRelativeDay,
  whatsappLink,
} from "@/lib/format";
import { isActiveLead, isContactBlocked } from "@/lib/leads/contact-policy";
import { leadIdSchema } from "@/lib/validations/lead";

export const metadata: Metadata = { title: "Lead" };

const RECENT_MESSAGES = 6;

export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <PageContainer>
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Leads
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <LeadProfile params={params} />
      </Suspense>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{children}</dd>
    </div>
  );
}

async function LeadProfile({ params }: { params: PageProps<"/leads/[id]">["params"] }) {
  const { id } = await params;
  const parsedId = leadIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const profile = await getLeadProfile(parsedId.data);
  if (!profile) notFound();

  const { lead, summary, now, messages, followups, suggestions, events, sale, nextFollowup } = profile;
  const blocked = isContactBlocked(lead);
  const conversationHref = `/inbox?c=${lead.id}`;
  const recentMessages = messages.slice(-RECENT_MESSAGES);

  return (
    <>
      <header className="flex flex-wrap items-start gap-4">
        <Avatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            {lead.name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {formatPhone(lead.phone)} · {formatPets(lead.petCount, lead.petNames)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={lead.status} />
            <TemperatureBadge temperature={lead.temperature} />
            <ScoreMeter score={lead.leadScore} />
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href={conversationHref} className={buttonStyles({ variant: "primary" })}>
            <MessagesSquare aria-hidden />
            Ver conversa
          </Link>
          {blocked ? null : (
            <a
              href={whatsappLink(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles()}
            >
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
        {isActiveLead(lead) ? (
          <LeadActions leadId={lead.id} leadName={lead.name} density="full" className="w-full" />
        ) : null}
      </header>

      {blocked ? (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
          Este cliente pediu para não ser contatado. Nenhum follow-up será criado e nenhuma mensagem
          será sugerida.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Resumo da conversa">
            {summary ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-zinc-800">{summary.summary}</p>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <Field label="Intenção">{summary.customerIntent ?? "—"}</Field>
                  <Field label="Objeção principal">{lead.mainObjection ?? "Nenhuma identificada"}</Field>
                  <Field label="Próxima ação">{summary.recommendedNextAction ?? "—"}</Field>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Ainda não há resumo para este lead.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Mensagens"
            description={
              messages.length > RECENT_MESSAGES
                ? `Últimas ${RECENT_MESSAGES} de ${messages.length} mensagens`
                : undefined
            }
            action={
              <Link href={conversationHref} className={buttonStyles({ variant: "ghost", size: "sm" })}>
                Abrir conversa
              </Link>
            }
          >
            {recentMessages.length > 0 ? (
              <MessageThread messages={recentMessages} now={now} />
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma mensagem trocada ainda.</p>
            )}
          </SectionCard>

          <SectionCard title="Sugestões de mensagem">
            {suggestions.length > 0 ? (
              <ul className="space-y-3">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{SUGGESTION_TYPE_LABELS[suggestion.type]}</Badge>
                      <Badge tone={suggestion.sentAt ? "success" : "neutral"}>
                        {suggestion.sentAt ? "Enviada" : "Aguardando sua revisão"}
                      </Badge>
                      <span className="ml-auto text-xs text-zinc-400">
                        {formatDateTime(suggestion.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-800">
                      {suggestion.editedContent ?? suggestion.content}
                    </p>
                    {suggestion.reason ? (
                      <p className="mt-2 text-xs text-zinc-500">Motivo: {suggestion.reason}</p>
                    ) : null}
                    {suggestion.sentAt || blocked ? null : (
                      <Link
                        href={conversationHref}
                        className={buttonStyles({ size: "sm", className: "mt-3" })}
                      >
                        <PenLine aria-hidden />
                        Revisar e enviar
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma sugestão gerada para este lead.</p>
            )}
          </SectionCard>

          <SectionCard title="Histórico">
            <LeadTimeline events={events} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Dados do lead">
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <Field label="Telefone">{formatPhone(lead.phone)}</Field>
              <Field label="E-mail">{lead.email ?? "—"}</Field>
              <Field label="Pets">{formatPets(lead.petCount, lead.petNames)}</Field>
              <Field label="Origem">{LEAD_SOURCE_LABELS[lead.source]}</Field>
              <Field label="Plano de interesse">{lead.planInterest ?? "—"}</Field>
              <Field label="Primeiro contato">{formatLongDate(lead.createdAt)}</Field>
              <Field label="Último contato">
                {lead.lastContactAt ? formatRelativeDay(lead.lastContactAt, now) : "—"}
              </Field>
              <Field label="Próximo follow-up">
                {nextFollowup ? formatRelativeDay(nextFollowup.scheduledFor, now) : "—"}
              </Field>
              {lead.lostReason ? <Field label="Motivo da perda">{lead.lostReason}</Field> : null}
            </dl>
            {lead.notes ? (
              <p className="mt-4 border-t border-zinc-100 pt-4 text-sm whitespace-pre-wrap text-zinc-700">
                {lead.notes}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Venda">
            {sale ? (
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Field label="Plano">{sale.planName ?? "—"}</Field>
                <Field label="Fechada em">{formatLongDate(sale.closedAt)}</Field>
                {sale.monthlyValue ? (
                  <Field label="Mensalidade">{formatCurrency(sale.monthlyValue)}</Field>
                ) : null}
                <Field label="Origem da venda">{LEAD_SOURCE_LABELS[sale.source]}</Field>
                {sale.followupId ? <Field label="Veio de follow-up">Sim</Field> : null}
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma venda registrada.</p>
            )}
          </SectionCard>

          <SectionCard title="Follow-ups">
            {followups.length > 0 ? (
              <ul className="space-y-3">
                {followups.map((followup) => (
                  <li key={followup.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900">
                        {formatRelativeDay(followup.scheduledFor, now)}
                      </p>
                      <Badge tone={FOLLOWUP_STATUS_TONES[followup.status]}>
                        {FOLLOWUP_STATUS_LABELS[followup.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600">{followup.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                {blocked ? "Follow-ups desativados para este lead." : "Nenhum follow-up agendado."}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
