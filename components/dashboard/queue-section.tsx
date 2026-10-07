import type { QueueItem } from "@/lib/data/dashboard";
import type { QueueBucket } from "@/lib/leads/priority";
import { cn } from "@/lib/utils";

import { QueueCard } from "./queue-card";

const BUCKETS: Record<QueueBucket, { title: string; description: string; marker: string }> = {
  HIGH: {
    title: "Prioridade alta",
    description: "Clientes esperando resposta ou prontos para avançar.",
    marker: "bg-accent-500",
  },
  MEDIUM: {
    title: "Prioridade média",
    description: "Follow-ups leves combinados para hoje.",
    marker: "bg-amber-400",
  },
  REACTIVATION: {
    title: "Reativação",
    description: "Conversas paradas há mais tempo. Retomar sem pressão.",
    marker: "bg-sky-400",
  },
};

type QueueSectionProps = { bucket: QueueBucket; items: QueueItem[]; now: Date };

export function QueueSection({ bucket, items, now }: QueueSectionProps) {
  if (items.length === 0) return null;
  const { title, description, marker } = BUCKETS[bucket];

  return (
    <section aria-labelledby={`queue-${bucket}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("size-2.5 rounded-full", marker)} aria-hidden />
        <h3 id={`queue-${bucket}`} className="text-sm font-semibold text-zinc-900">
          {title}
        </h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 tabular-nums">
          {items.length}
        </span>
        <p className="hidden text-xs text-zinc-500 sm:block">{description}</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <QueueCard key={item.lead.id} item={item} now={now} />
        ))}
      </div>
    </section>
  );
}
