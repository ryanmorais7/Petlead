import { Ban, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { TemperatureBadge } from "@/components/leads/lead-badges";
import { Badge } from "@/components/ui/badge";
import { PendingAction } from "@/components/ui/pending-action";
import { ScoreMeter } from "@/components/ui/score-meter";
import type { InboxThread } from "@/lib/data/inbox";
import { SUGGESTION_TYPE_LABELS } from "@/lib/domain/labels";
import { isContactBlocked } from "@/lib/leads/contact-policy";

import { SuggestionBox } from "./suggestion-box";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500">{title}</h3>
      <div className="mt-1 text-sm text-zinc-900">{children}</div>
    </div>
  );
}

/** Right column of the inbox: what we know about the customer and what to do next. */
export function IntelligencePanel({ thread }: { thread: InboxThread }) {
  const { lead, summary, suggestion, tones } = thread;
  const blocked = isContactBlocked(lead);

  return (
    <div className="space-y-5 p-4">
      <Block title="Resumo do cliente">
        <p className="leading-relaxed text-zinc-800">
          {summary?.summary ?? "Ainda não há resumo para esta conversa."}
        </p>
      </Block>

      <div className="grid grid-cols-2 gap-4">
        <Block title="Intenção">{summary?.customerIntent ?? "—"}</Block>
        <Block title="Objeção">{lead.mainObjection ?? "Nenhuma identificada"}</Block>
        <Block title="Temperatura">
          <TemperatureBadge temperature={lead.temperature} />
        </Block>
        <Block title="Score">
          <ScoreMeter score={lead.leadScore} />
        </Block>
      </div>

      <Block title="Próxima ação recomendada">
        <p className="font-medium">{summary?.recommendedNextAction ?? "—"}</p>
      </Block>

      <section className="border-t border-zinc-100 pt-5" aria-labelledby="suggestion-title">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-brand-600" aria-hidden />
          <h3 id="suggestion-title" className="text-sm font-semibold text-zinc-900">
            Mensagem sugerida
          </h3>
          {suggestion ? (
            <Badge tone="brand" className="ml-auto">
              {SUGGESTION_TYPE_LABELS[suggestion.type]}
            </Badge>
          ) : null}
        </div>

        {blocked ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            Este cliente pediu para não ser contatado. Nenhuma mensagem será sugerida.
          </p>
        ) : suggestion ? (
          <>
            {suggestion.reason ? (
              <p className="mb-3 text-xs text-zinc-500">{suggestion.reason}</p>
            ) : null}
            {/* The key resets the draft when another conversation is opened. */}
            <SuggestionBox
              key={suggestion.id}
              phone={lead.phone}
              content={suggestion.content}
              tones={tones}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center">
            <p className="text-sm text-zinc-500">Nenhuma mensagem pendente para este cliente.</p>
            <PendingAction requires="o gerador de mensagens" size="sm" className="mt-3">
              <Sparkles aria-hidden />
              Gerar mensagem
            </PendingAction>
          </div>
        )}
      </section>
    </div>
  );
}
