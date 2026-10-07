import { Ban, CheckCircle2, Clock, MessageCircle, MessagesSquare, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";

import { StatusBadge, TemperatureBadge } from "@/components/leads/lead-badges";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingAction } from "@/components/ui/pending-action";
import { ScoreMeter } from "@/components/ui/score-meter";
import type { QueueItem } from "@/lib/data/dashboard";
import { formatPets, formatPhone, formatRelativeDay, whatsappLink } from "@/lib/format";

export function QueueCard({ item, now }: { item: QueueItem; now: Date }) {
  const { lead, summary, suggestion, priority } = item;
  const conversationHref = `/inbox?c=${lead.id}`;

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={lead.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/leads/${lead.id}`}
              className="truncate text-sm font-semibold text-zinc-900 hover:text-brand-700"
            >
              {lead.name}
            </Link>
            <StatusBadge status={lead.status} />
            <TemperatureBadge temperature={lead.temperature} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {formatPhone(lead.phone)} · {formatPets(lead.petCount, lead.petNames)}
          </p>
        </div>
        <ScoreMeter score={lead.leadScore} className="mt-0.5 shrink-0" />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-xs font-medium text-zinc-500 sm:w-32">Último contato</dt>
          <dd className="text-zinc-700">
            {lead.lastContactAt ? formatRelativeDay(lead.lastContactAt, now) : "sem contato"}
          </dd>
        </div>
        {summary ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-xs font-medium text-zinc-500 sm:w-32">Situação</dt>
            <dd className="line-clamp-3 text-zinc-700">{summary.summary}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-xs font-medium text-zinc-500 sm:w-32">Recomendação</dt>
          <dd className="font-medium text-zinc-900">
            {summary?.recommendedNextAction ?? priority.reason}
          </dd>
        </div>
      </dl>

      {suggestion ? (
        <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand-800">
            <Sparkles className="size-3.5" aria-hidden />
            Mensagem sugerida
          </p>
          <p className="mt-1.5 line-clamp-3 text-sm text-zinc-800">{suggestion.content}</p>
        </div>
      ) : null}

      {/* Pushes the actions to the bottom so cards in the same row line up. */}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {suggestion ? (
          <Link href={conversationHref} className={buttonStyles({ variant: "primary", size: "sm" })}>
            <PenLine aria-hidden />
            Revisar e enviar
          </Link>
        ) : (
          <PendingAction requires="o gerador de mensagens" variant="primary" size="sm">
            <Sparkles aria-hidden />
            Gerar mensagem
          </PendingAction>
        )}
        <Link href={conversationHref} className={buttonStyles({ size: "sm" })}>
          <MessagesSquare aria-hidden />
          Ver conversa
        </Link>
        <a
          href={whatsappLink(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ size: "sm" })}
        >
          <MessageCircle aria-hidden />
          WhatsApp
        </a>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-100 pt-3">
        <PendingAction requires="o banco de dados" variant="ghost" size="sm">
          <Clock aria-hidden />
          Adiar
        </PendingAction>
        <PendingAction requires="o banco de dados" variant="ghost" size="sm">
          <CheckCircle2 aria-hidden />
          Fechado
        </PendingAction>
        <PendingAction requires="o banco de dados" variant="ghost" size="sm">
          <Ban aria-hidden />
          Não contatar
        </PendingAction>
      </div>
    </Card>
  );
}
