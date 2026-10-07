import {
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  FileText,
  ImageIcon,
  Mic,
  Paperclip,
  type LucideIcon,
} from "lucide-react";

import type { Message } from "@/db/schema";
import type { MessageStatus, MessageType } from "@/lib/domain/enums";
import { dayKey, formatThreadDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ATTACHMENT_ICONS: Record<Exclude<MessageType, "TEXT">, LucideIcon> = {
  AUDIO: Mic,
  IMAGE: ImageIcon,
  DOCUMENT: FileText,
  OTHER: Paperclip,
};

const ATTACHMENT_LABELS: Record<Exclude<MessageType, "TEXT">, string> = {
  AUDIO: "Áudio",
  IMAGE: "Imagem",
  DOCUMENT: "Documento",
  OTHER: "Anexo",
};

/** WhatsApp-like delivery marks for messages we sent. */
function DeliveryIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case "PENDING":
      return <Clock className="size-3.5" aria-label="Enviando" />;
    case "SENT":
      return <Check className="size-3.5" aria-label="Enviada" />;
    case "DELIVERED":
      return <CheckCheck className="size-3.5" aria-label="Entregue" />;
    case "READ":
      return <CheckCheck className="size-3.5 text-sky-300" aria-label="Lida" />;
    case "FAILED":
      return <CircleAlert className="size-3.5 text-accent-300" aria-label="Falhou" />;
    default:
      return null;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "OUTBOUND";
  const AttachmentIcon = message.type === "TEXT" ? null : ATTACHMENT_ICONS[message.type];

  return (
    <li className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-card sm:max-w-[70%]",
          outbound
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md border border-zinc-200 bg-white text-zinc-900",
        )}
      >
        <span className="sr-only">{outbound ? "Você: " : "Cliente: "}</span>
        {AttachmentIcon && message.type !== "TEXT" ? (
          <span
            className={cn(
              "mb-1 flex items-center gap-1.5 text-xs font-medium",
              outbound ? "text-brand-100" : "text-zinc-500",
            )}
          >
            <AttachmentIcon className="size-3.5" aria-hidden />
            {ATTACHMENT_LABELS[message.type]}
          </span>
        ) : null}
        {message.text ? <p className="break-words whitespace-pre-wrap">{message.text}</p> : null}
        <span
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px] tabular-nums",
            outbound ? "text-brand-100" : "text-zinc-400",
          )}
        >
          {message.status === "FAILED" ? "Não enviada · " : null}
          {formatTime(message.timestamp)}
          {outbound ? <DeliveryIcon status={message.status} /> : null}
        </span>
      </div>
    </li>
  );
}

type MessageThreadProps = { messages: Message[]; now: Date; className?: string };

/** WhatsApp-style history, oldest first, with a separator for each day. */
export function MessageThread({ messages, now, className }: MessageThreadProps) {
  const days = new Map<string, Message[]>();
  for (const message of messages) {
    const key = dayKey(message.timestamp);
    days.set(key, [...(days.get(key) ?? []), message]);
  }

  return (
    <div className={cn("space-y-4", className)}>
      {[...days.entries()].map(([key, dayMessages]) => (
        <section key={key} aria-label={formatThreadDay(dayMessages[0].timestamp, now)}>
          <p className="mx-auto mb-3 w-fit rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
            {formatThreadDay(dayMessages[0].timestamp, now)}
          </p>
          <ul className="space-y-1.5">
            {dayMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
