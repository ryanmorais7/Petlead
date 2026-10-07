import { ArrowLeft, ChevronRight, Clock, MessagesSquare, PanelRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MessageThread } from "@/components/conversation/message-thread";
import { ConversationList } from "@/components/inbox/conversation-list";
import { IntelligencePanel } from "@/components/inbox/intelligence-panel";
import { MessageComposer } from "@/components/inbox/message-composer";
import { StatusBadge } from "@/components/leads/lead-badges";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getInbox } from "@/lib/data/inbox";
import { calendarDaysBetween, formatPets, formatTime } from "@/lib/format";
import { isContactBlocked } from "@/lib/leads/contact-policy";
import { cn } from "@/lib/utils";
import { leadIdSchema } from "@/lib/validations/lead";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import { getConversationWindow, WINDOW_LABELS } from "@/lib/whatsapp/conversation-window";
import { getSendBlock } from "@/lib/whatsapp/send-policy";

export const metadata: Metadata = { title: "Conversas" };

/** Fills the viewport: full height on desktop, above the tab bar on phones. */
const FRAME = "flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] bg-white lg:h-dvh";

export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

function InboxSkeleton() {
  return (
    <div className={FRAME} role="status" aria-label="Carregando conversas">
      <div className="w-full space-y-3 border-r border-zinc-200 p-4 md:w-80">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <div className="hidden flex-1 md:block" />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function Inbox({ searchParams }: { searchParams: PageProps<"/inbox">["searchParams"] }) {
  const params = await searchParams;
  const requestedId = leadIdSchema.safeParse(first(params.c));
  // On small screens the intelligence panel replaces the thread instead of sitting beside it.
  const panelOpen = first(params.painel) === "1";

  const { conversations, selected, now } = await getInbox(
    requestedId.success ? requestedId.data : undefined,
  );
  const threadHref = selected ? `/inbox?c=${selected.lead.id}` : "/inbox";

  // Shown to the seller here and enforced again by the server on every send.
  const lastInbound = selected?.messages.findLast((message) => message.direction === "INBOUND");
  const conversationWindow = getConversationWindow(lastInbound?.timestamp ?? null, now);
  const sendBlock = selected
    ? getSendBlock({
        lead: selected.lead,
        window: conversationWindow.state,
        configured: isWhatsAppConfigured(),
      })
    : null;

  return (
    <div className={FRAME}>
      <aside
        aria-label="Conversas"
        className={cn(
          "w-full shrink-0 flex-col border-r border-zinc-200 md:flex md:w-80",
          selected ? "hidden" : "flex",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Conversas</h1>
          <span className="text-xs text-zinc-500 tabular-nums">{conversations.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList conversations={conversations} selectedId={selected?.lead.id} now={now} />
        </div>
      </aside>

      {selected ? (
        <>
          <section
            aria-label={`Conversa com ${selected.lead.name}`}
            className={cn("min-w-0 flex-1 flex-col xl:flex", panelOpen ? "hidden" : "flex")}
          >
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 px-3 sm:px-4">
              <Link
                href="/inbox"
                aria-label="Voltar para as conversas"
                className={buttonStyles({ variant: "ghost", size: "sm", className: "px-1.5 md:hidden" })}
              >
                <ArrowLeft aria-hidden />
              </Link>
              <Avatar name={selected.lead.name} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/leads/${selected.lead.id}`}
                  className="block truncate text-sm font-semibold text-zinc-900 hover:text-brand-700"
                >
                  {selected.lead.name}
                </Link>
                <p className="truncate text-xs text-zinc-500">
                  {formatPets(selected.lead.petCount, selected.lead.petNames)}
                </p>
              </div>
              <span className="hidden sm:block">
                <StatusBadge status={selected.lead.status} />
              </span>
              <Link
                href={`${threadHref}&painel=1`}
                className={buttonStyles({ size: "sm", className: "xl:hidden" })}
              >
                <PanelRight aria-hidden />
                <span className="hidden sm:inline">Inteligência</span>
              </Link>
            </header>

            <p
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b px-4 py-1.5 text-xs font-medium",
                conversationWindow.state === "OPEN"
                  ? "border-brand-100 bg-brand-50 text-brand-800"
                  : "border-zinc-200 bg-zinc-100 text-zinc-600",
              )}
            >
              <Clock className="size-3.5" aria-hidden />
              {WINDOW_LABELS[conversationWindow.state]}
              {conversationWindow.state === "OPEN" && conversationWindow.expiresAt ? (
                <span className="font-normal">
                  · até {formatTime(conversationWindow.expiresAt)}
                  {calendarDaysBetween(now, conversationWindow.expiresAt) === 1 ? " de amanhã" : ""}
                </span>
              ) : null}
            </p>

            {/* Reversed column keeps the scroll anchored at the most recent message. */}
            <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-zinc-50 px-3 py-4 sm:px-6">
              {selected.messages.length > 0 ? (
                <MessageThread messages={selected.messages} now={now} />
              ) : (
                <p className="m-auto text-sm text-zinc-500">Nenhuma mensagem nesta conversa ainda.</p>
              )}
            </div>

            {selected.suggestion && !isContactBlocked(selected.lead) ? (
              <Link
                href={`${threadHref}&painel=1`}
                className="flex shrink-0 items-center gap-3 border-t border-brand-100 bg-brand-50 px-4 py-3 xl:hidden"
              >
                <Sparkles className="size-4 shrink-0 text-brand-600" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-brand-800">Mensagem sugerida pronta</span>
                  <span className="block truncate text-sm text-zinc-700">
                    {selected.suggestion.content}
                  </span>
                </span>
                <span className="flex shrink-0 items-center text-xs font-medium text-brand-700">
                  Revisar
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            ) : null}

            {/* The key clears the draft when another conversation is opened. */}
            <MessageComposer
              key={selected.lead.id}
              leadId={selected.lead.id}
              blockedReason={sendBlock?.message ?? null}
            />
          </section>

          <aside
            aria-label="Painel de inteligência"
            className={cn(
              "w-full min-w-0 flex-col border-zinc-200 xl:flex xl:w-96 xl:shrink-0 xl:border-l",
              panelOpen ? "flex md:flex-1 xl:flex-none" : "hidden",
            )}
          >
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-200 px-3 sm:px-4">
              <Link
                href={threadHref}
                aria-label="Voltar para a conversa"
                className={buttonStyles({ variant: "ghost", size: "sm", className: "px-1.5 xl:hidden" })}
              >
                <ArrowLeft aria-hidden />
              </Link>
              <h2 className="text-sm font-semibold text-zinc-900">Inteligência</h2>
              <span className="truncate text-xs text-zinc-500 xl:hidden">{selected.lead.name}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <IntelligencePanel thread={selected} sendBlockedReason={sendBlock?.message ?? null} />
            </div>
          </aside>
        </>
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-zinc-50 md:flex">
          <EmptyState
            icon={MessagesSquare}
            title="Selecione uma conversa"
            description="Escolha um cliente na lista para ver o histórico e a mensagem sugerida."
          />
        </div>
      )}
    </div>
  );
}
