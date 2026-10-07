"use client";

import { Check, Copy, MessageCircle, RefreshCw, RotateCcw, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { sendMessage } from "@/lib/actions/messages";
import { whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SUGGESTION_TONE_LABELS,
  SUGGESTION_TONES,
  type SuggestionTone,
} from "@/lib/validations/analysis";

type SuggestionBoxProps = {
  leadId: string;
  suggestionId: string;
  phone: string;
  /** Text proposed for this conversation. */
  content: string;
  /** Alternative wordings prepared in advance. */
  tones: Partial<Record<SuggestionTone, string>>;
  /** Why direct sending is unavailable right now. Null when the seller can send. */
  blockedReason: string | null;
};

/**
 * Review step of every outgoing message: the seller reads, adjusts the text
 * and decides to send. Nothing here sends anything on its own.
 */
export function SuggestionBox({
  leadId,
  suggestionId,
  phone,
  content,
  tones,
  blockedReason,
}: SuggestionBoxProps) {
  const [text, setText] = useState(content);
  const [activeTone, setActiveTone] = useState<SuggestionTone | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  const trimmed = text.trim();
  const edited = text !== (activeTone ? tones[activeTone] : content);

  function approveAndSend() {
    setError(null);
    startSending(async () => {
      const result = await sendMessage({ leadId, text: trimmed, suggestionId });
      if (!result.ok) setError(result.message);
    });
  }

  function applyTone(tone: SuggestionTone) {
    const variant = tones[tone];
    if (!variant) return;
    setActiveTone(tone);
    setText(variant);
  }

  function restore() {
    setActiveTone(null);
    setText(content);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text stays selectable in the field.
    }
  }

  return (
    <div>
      <label htmlFor="suggestion-text" className="sr-only">
        Mensagem para o cliente
      </label>
      <textarea
        id="suggestion-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        maxLength={4096}
        className="block w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      <p className="mt-1 flex justify-between text-[11px] text-zinc-400">
        <span>{edited ? "Editada por você" : "Você pode editar o texto antes de enviar"}</span>
        <span className="tabular-nums">{text.length}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Ajustar tom">
        {SUGGESTION_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            disabled={!tones[tone]}
            aria-pressed={activeTone === tone}
            onClick={() => applyTone(tone)}
            title={tones[tone] ? undefined : "Disponível ao conectar o gerador de mensagens"}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              activeTone === tone
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 enabled:hover:bg-zinc-50",
            )}
          >
            {SUGGESTION_TONE_LABELS[tone]}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button variant="ghost" size="sm" onClick={restore} disabled={!edited && activeTone === null}>
          <RotateCcw aria-hidden />
          Restaurar original
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Disponível ao conectar o gerador de mensagens"
        >
          <RefreshCw aria-hidden />
          Gerar outra
        </Button>
      </div>

      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
        <Button
          variant="primary"
          disabled={blockedReason !== null || sending || !trimmed}
          onClick={approveAndSend}
          className="w-full"
        >
          <Send aria-hidden />
          {sending ? "Enviando..." : "Aprovar e enviar"}
        </Button>
        {error ? (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={trimmed ? whatsappLink(phone, trimmed) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!trimmed}
            className={buttonStyles()}
          >
            <MessageCircle aria-hidden />
            Abrir no WhatsApp
          </a>
          <Button onClick={copy} disabled={!trimmed}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copiada" : "Copiar"}
          </Button>
        </div>
        {blockedReason ? (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {blockedReason} Você ainda pode abrir a conversa no WhatsApp com o texto já preenchido
            e enviar por lá.
          </p>
        ) : null}
      </div>
    </div>
  );
}
