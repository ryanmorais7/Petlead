import {
  Ban,
  CalendarPlus,
  CircleCheckBig,
  MessageSquareReply,
  MessageSquareText,
  RefreshCw,
  Send,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import type { LeadEvent } from "@/db/schema";
import type { LeadEventType } from "@/lib/domain/enums";
import { LEAD_EVENT_LABELS } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<LeadEventType, LucideIcon> = {
  LEAD_CREATED: UserPlus,
  MESSAGE_RECEIVED: MessageSquareText,
  MESSAGE_SENT: MessageSquareReply,
  STATUS_CHANGED: RefreshCw,
  FOLLOWUP_CREATED: CalendarPlus,
  FOLLOWUP_SENT: Send,
  SALE_CLOSED: CircleCheckBig,
  DO_NOT_CONTACT_SET: Ban,
};

const HIGHLIGHT: Partial<Record<LeadEventType, string>> = {
  SALE_CLOSED: "bg-brand-600 text-white",
  DO_NOT_CONTACT_SET: "bg-red-100 text-red-700",
};

/** Audit trail of the lead, most recent first. */
export function LeadTimeline({ events }: { events: LeadEvent[] }) {
  return (
    <ol className="space-y-4">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type];
        return (
          <li key={event.id} className="relative flex gap-3">
            {index < events.length - 1 ? (
              <span className="absolute top-8 bottom-[-1rem] left-[0.9375rem] w-px bg-zinc-200" aria-hidden />
            ) : null}
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full",
                HIGHLIGHT[event.type] ?? "bg-zinc-100 text-zinc-500",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-zinc-900">{LEAD_EVENT_LABELS[event.type]}</p>
              {event.description ? (
                <p className="line-clamp-2 text-sm text-zinc-600">{event.description}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-zinc-400">{formatDateTime(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
