import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  /** Highlights the number the seller should look at first. */
  emphasis?: boolean;
  className?: string;
};

export function StatCard({ label, value, icon: Icon, hint, emphasis, className }: StatCardProps) {
  return (
    <Card className={cn("p-4", emphasis && "border-accent-200 bg-accent-50/60", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <Icon
          className={cn("size-4 shrink-0", emphasis ? "text-accent-600" : "text-zinc-400")}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}
