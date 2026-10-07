import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import type { LeadOverview } from "@/lib/data/source";
import { formatListTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

type ConversationListProps = { conversations: LeadOverview[]; selectedId?: string; now: Date };

export function ConversationList({ conversations, selectedId, now }: ConversationListProps) {
  return (
    <ul className="divide-y divide-zinc-100">
      {conversations.map(({ lead, lastMessage, awaitingReply }) => {
        if (!lastMessage) return null;
        const selected = lead.id === selectedId;
        return (
          <li key={lead.id}>
            <Link
              href={`/inbox?c=${lead.id}`}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                selected ? "bg-brand-50" : "hover:bg-zinc-50",
              )}
            >
              <Avatar name={lead.name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm text-zinc-900",
                      awaitingReply ? "font-semibold" : "font-medium",
                    )}
                  >
                    {lead.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      awaitingReply ? "font-medium text-accent-600" : "text-zinc-400",
                    )}
                  >
                    {formatListTimestamp(lastMessage.timestamp, now)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-xs",
                      awaitingReply ? "text-zinc-800" : "text-zinc-500",
                    )}
                  >
                    {lastMessage.direction === "OUTBOUND" ? "Você: " : ""}
                    {lastMessage.text}
                  </span>
                  {awaitingReply ? (
                    <span className="ml-auto size-2 shrink-0 rounded-full bg-accent-500">
                      <span className="sr-only">Aguardando resposta</span>
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
