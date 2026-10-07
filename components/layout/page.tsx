import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard width and padding of a scrolling page. */
export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8", className)}>
      {children}
    </div>
  );
}

type PageHeaderProps = { title: string; description?: ReactNode; action?: ReactNode };

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
