"use client";

import { Ban, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  closeLead,
  markLeadLost,
  reopenLead,
  setDoNotContact,
  snoozeLead,
  type ActionResult,
} from "@/lib/actions/leads";
import type { LeadStatus } from "@/lib/domain/enums";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";

const SNOOZE_OPTIONS = [
  { days: 1, label: "Amanhã" },
  { days: 3, label: "Em 3 dias" },
  { days: 7, label: "Em 1 semana" },
] as const;

/** Common reasons, so the loss report groups them consistently. */
const LOST_REASONS = [
  "Preço",
  "Já tem outro plano",
  "Sem interesse no momento",
  "Parou de responder",
] as const;

type LeadActionsProps = {
  leadId: string;
  leadName: string;
  /** "compact" for queue cards, "full" for the lead profile header. */
  density?: "compact" | "full";
  className?: string;
};

type Panel = "snooze" | "lost" | null;

/** Postpone, close, lose or block a lead. Each change is saved and logged in its history. */
export function LeadActions({ leadId, leadName, density = "compact", className }: LeadActionsProps) {
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const compact = density === "compact";
  const size = compact ? "sm" : "md";
  const variant = compact ? "ghost" : "secondary";
  const name = firstName(leadName);

  function submit(action: () => Promise<ActionResult>) {
    setError(null);
    setPanel(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));

  function confirmClose() {
    if (window.confirm(`Marcar ${name} como venda fechada?`)) {
      submit(() => closeLead({ leadId }));
    }
  }

  function confirmBlock() {
    const question = `Marcar ${name} como "não contatar"? Os follow-ups agendados serão cancelados e nenhuma mensagem será sugerida.`;
    if (window.confirm(question)) {
      submit(() => setDoNotContact({ leadId }));
    }
  }

  return (
    <div className={className}>
      <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")}>
        <Button
          variant={variant}
          size={size}
          disabled={pending}
          aria-expanded={panel === "snooze"}
          onClick={() => toggle("snooze")}
        >
          <Clock aria-hidden />
          Adiar
        </Button>
        <Button variant={variant} size={size} disabled={pending} onClick={confirmClose}>
          <CheckCircle2 aria-hidden />
          {compact ? "Fechado" : "Marcar como fechado"}
        </Button>
        <Button
          variant={variant}
          size={size}
          disabled={pending}
          aria-expanded={panel === "lost"}
          onClick={() => toggle("lost")}
        >
          <XCircle aria-hidden />
          Perdido
        </Button>
        <Button variant={compact ? "ghost" : "danger"} size={size} disabled={pending} onClick={confirmBlock}>
          <Ban aria-hidden />
          Não contatar
        </Button>
      </div>

      {panel === "snooze" ? (
        <div
          role="group"
          aria-label="Chamar novamente"
          className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-zinc-50 p-2"
        >
          <span className="px-1 text-xs text-zinc-500">Chamar novamente:</span>
          {SNOOZE_OPTIONS.map(({ days, label }) => (
            <Button
              key={days}
              size="sm"
              disabled={pending}
              onClick={() => submit(() => snoozeLead({ leadId, days }))}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}

      {panel === "lost" ? (
        <div role="group" aria-label="Motivo da perda" className="mt-2 rounded-lg bg-zinc-50 p-2">
          <p className="px-1 text-xs text-zinc-500">Por que este lead foi perdido?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LOST_REASONS.map((reason) => (
              <Button
                key={reason}
                size="sm"
                disabled={pending}
                onClick={() => submit(() => markLeadLost({ leadId, reason }))}
              >
                {reason}
              </Button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (otherReason.trim()) submit(() => markLeadLost({ leadId, reason: otherReason }));
            }}
          >
            <label htmlFor={`lost-${leadId}`} className="sr-only">
              Outro motivo
            </label>
            <input
              id={`lost-${leadId}`}
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
              maxLength={300}
              placeholder="Outro motivo"
              className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={pending || !otherReason.trim()}>
              Salvar
            </Button>
          </form>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const REOPEN: Partial<Record<LeadStatus, { label: string; confirm: (name: string) => string }>> = {
  CLOSED: {
    label: "Desfazer venda",
    confirm: (name) => `Desfazer a venda de ${name}? O registro da venda será apagado e o lead volta para o funil.`,
  },
  LOST: {
    label: "Reabrir lead",
    confirm: (name) => `Reabrir ${name}? O lead volta para o funil.`,
  },
  DO_NOT_CONTACT: {
    label: "Permitir contato novamente",
    confirm: (name) =>
      `${name} pediu para não ser contatado. Libere o contato apenas se o próprio cliente pediu para voltar a conversar. Liberar?`,
  },
};

/** Undo for a closed, lost or blocked lead. */
export function ReopenLeadButton({ leadId, leadName, status }: { leadId: string; leadName: string; status: LeadStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const option = REOPEN[status];
  if (!option) return null;

  function reopen() {
    if (!option || !window.confirm(option.confirm(firstName(leadName)))) return;
    setError(null);
    startTransition(async () => {
      const result = await reopenLead({ leadId });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div>
      <Button disabled={pending} onClick={reopen}>
        <RotateCcw aria-hidden />
        {option.label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
