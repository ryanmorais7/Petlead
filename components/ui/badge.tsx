import type { ReactNode } from "react";

import type { Tone } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-brand-600 text-white ring-brand-600",
  accent: "bg-accent-50 text-accent-800 ring-accent-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-zinc-400",
  brand: "bg-brand-500",
  success: "bg-white",
  accent: "bg-accent-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  danger: "bg-red-500",
};

type BadgeProps = { tone?: Tone; dot?: boolean; className?: string; children: ReactNode };

export function Badge({ tone = "neutral", dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}
