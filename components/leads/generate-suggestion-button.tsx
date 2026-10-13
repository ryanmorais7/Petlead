"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { generateSuggestion } from "@/lib/actions/suggestions";

type GenerateSuggestionButtonProps = {
  leadId: string;
  /** "another" asks for a different take on a suggestion that already exists. */
  mode?: "first" | "another";
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
};

/** Asks for a suggested message. The result is a draft the seller still reviews and sends. */
export function GenerateSuggestionButton({
  leadId,
  mode = "first",
  variant = "primary",
  size = "sm",
  className,
}: GenerateSuggestionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const another = mode === "another";

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateSuggestion({ leadId, instruction: another ? "another" : undefined });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <span className={className}>
      <Button variant={variant} size={size} disabled={pending} onClick={generate}>
        {another ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
        {pending ? "Gerando..." : another ? "Gerar outra" : "Gerar mensagem"}
      </Button>
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
