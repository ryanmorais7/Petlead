import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { aiSuggestions, leadEvents, leads, messages } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { AppError } from "@/lib/errors";

import { getConversationWindow } from "./conversation-window";
import { getOrCreateConversation } from "./inbound";
import { getSendBlock } from "./send-policy";

/** WhatsApp text messages are limited to 4096 characters. */
const inputSchema = z.object({
  userId: z.uuid(),
  leadId: z.uuid(),
  text: z.string().trim().min(1).max(4096),
  suggestionId: z.uuid().optional(),
});

export type SendLeadMessageInput = z.input<typeof inputSchema>;

export type SendLeadMessageDeps = {
  isConfigured: () => boolean;
  send: (input: { to: string; text: string }) => Promise<{ messageId: string }>;
  now?: () => Date;
};

/**
 * Sends a message written or approved by the seller to one of their leads.
 *
 * Everything that decides whether the message may go out is resolved here, on
 * the server, from the database: the caller only says which lead and what text.
 * The phone number is never taken from the request.
 */
export async function sendLeadMessage(
  db: DbClient,
  input: SendLeadMessageInput,
  deps: SendLeadMessageDeps,
): Promise<{ messageId: string }> {
  const { userId, leadId, text, suggestionId } = inputSchema.parse(input);
  const now = deps.now?.() ?? new Date();

  // A lead of another seller is indistinguishable from one that does not exist.
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.ownerUserId, userId)))
    .limit(1);
  if (!lead) throw new AppError("NOT_FOUND", `Lead ${leadId} not found for user ${userId}`);

  const [lastInbound] = await db
    .select({ timestamp: messages.timestamp })
    .from(messages)
    .where(and(eq(messages.leadId, lead.id), eq(messages.direction, "INBOUND")))
    .orderBy(desc(messages.timestamp))
    .limit(1);

  const block = getSendBlock({
    lead,
    window: getConversationWindow(lastInbound?.timestamp ?? null, now).state,
    configured: deps.isConfigured(),
  });
  if (block) throw new AppError(block.code, `Send blocked for lead ${lead.id}: ${block.code}`);

  // Recorded before the call, so a message is never sent without a trace.
  const conversationId = await getOrCreateConversation(db, lead.id);
  const [pending] = await db
    .insert(messages)
    .values({
      conversationId,
      leadId: lead.id,
      direction: "OUTBOUND",
      type: "TEXT",
      text,
      timestamp: now,
      status: "PENDING",
    })
    .returning({ id: messages.id });

  let whatsappMessageId: string;
  try {
    ({ messageId: whatsappMessageId } = await deps.send({ to: lead.phone, text }));
  } catch (error) {
    await db.update(messages).set({ status: "FAILED" }).where(eq(messages.id, pending.id));
    throw error;
  }

  // From here on, delivery receipts find the message by its WhatsApp id.
  await db
    .update(messages)
    .set({ whatsappMessageId, status: "SENT" })
    .where(eq(messages.id, pending.id));

  await db
    .update(leads)
    .set({ lastContactAt: now, ...(lead.status === "NEW" ? { status: "CONTACTED" as const } : {}) })
    .where(eq(leads.id, lead.id));

  if (suggestionId) {
    const [suggestion] = await db
      .select({ content: aiSuggestions.content })
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.id, suggestionId), eq(aiSuggestions.leadId, lead.id)))
      .limit(1);
    if (suggestion) {
      await db
        .update(aiSuggestions)
        .set({
          approved: true,
          sentAt: now,
          editedContent: suggestion.content === text ? null : text,
        })
        .where(eq(aiSuggestions.id, suggestionId));
    }
  }

  await db.insert(leadEvents).values({
    leadId: lead.id,
    userId,
    type: "MESSAGE_SENT",
    description: text,
    createdAt: now,
  });

  return { messageId: pending.id };
}
