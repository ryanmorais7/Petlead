"use client";

import { Ban, CheckCircle2, Clock } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { closeLead, setDoNotContact, snoozeLead, type ActionResult } from "@/lib/actions/leads";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";

const SNOOZE_OPTIONS = [
  { days: 1, label: "Amanhã" },
  { days: 3, label: "Em 3 dias" },
  { days: 7, label: "Em 1 semana" },
] as const;

type LeadActionsProps = {
  leadId: string;
  leadName: string;
  /** "compact" for queue cards, "full" for the lead profile header. */
  density?: "compact" | "full";
  className?: string;
};

/** Postpone, close or block a lead. Each change is saved and logged in its history. */
export function LeadActions({ leadId, leadName, density = "compact", className }: LeadActionsProps) {
  const [pending, startTransition] = useTransition();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compact = density === "compact";
  const size = compact ? "sm" : "md";
  const name = firstName(leadName);

  function submit(action: () => Promise<ActionResult>) {
    setError(null);
    setSnoozeOpen(false);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

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
          variant={compact ? "ghost" : "secondary"}
          size={size}
          disabled={pending}
          aria-expanded={snoozeOpen}
          onClick={() => setSnoozeOpen((open) => !open)}
        >
          <Clock aria-hidden />
          Adiar
        </Button>
        <Button
          variant={compact ? "ghost" : "secondary"}
          size={size}
          disabled={pending}
          onClick={confirmClose}
        >
          <CheckCircle2 aria-hidden />
          {compact ? "Fechado" : "Marcar como fechado"}
        </Button>
        <Button
          variant={compact ? "ghost" : "danger"}
          size={size}
          disabled={pending}
          onClick={confirmBlock}
        >
          <Ban aria-hidden />
          Não contatar
        </Button>
      </div>

      {snoozeOpen ? (
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

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
