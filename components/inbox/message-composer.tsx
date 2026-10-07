"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/actions/messages";

type MessageComposerProps = {
  leadId: string;
  /** Why sending is unavailable right now. Null when the seller can send. */
  blockedReason: string | null;
};

/** Free-form reply box of a conversation. The server re-checks every rule before sending. */
export function MessageComposer({ leadId, blockedReason }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const blocked = blockedReason !== null;
  const canSend = !blocked && !pending && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessage({ leadId, text });
      if (result.ok) setText("");
      else setError(result.message);
    });
  }

  return (
    <form
      className="shrink-0 border-t border-zinc-200 bg-white px-3 py-2.5 sm:px-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error ? (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="composer-text" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="composer-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd + Enter sends; plain Enter keeps writing, as on a phone.
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4096}
          disabled={blocked || pending}
          placeholder={blocked ? "Envio indisponível" : "Escreva uma mensagem"}
          className="block max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 [field-sizing:content] placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-zinc-50"
        />
        <Button type="submit" variant="primary" disabled={!canSend}>
          <Send aria-hidden />
          {pending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
      {blockedReason ? <p className="mt-1.5 text-xs text-zinc-500">{blockedReason}</p> : null}
    </form>
  );
}
