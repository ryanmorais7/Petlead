import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-zinc-200 bg-white shadow-card", className)}
      {...props}
    />
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Card with a titled header, used for the blocks of detail pages. */
export function SectionCard({ title, description, action, className, children }: SectionCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </Card>
  );
}
