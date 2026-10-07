import { and, eq, inArray, sql } from "drizzle-orm";

import { conversations, leadEvents, leads, messages, type Lead } from "@/db/schema";
import type { DbClient } from "@/db/types";
import type { MessageType } from "@/lib/domain/enums";
import { formatPhone } from "@/lib/format";
import type { WebhookMessage } from "@/lib/validations/whatsapp";

import { normalizePhone, phoneVariants } from "./phone";

export type InboundResult = "saved" | "duplicate";

const TYPE_MAP: Record<string, MessageType> = {
  text: "TEXT",
  button: "TEXT",
  interactive: "TEXT",
  audio: "AUDIO",
  voice: "AUDIO",
  image: "IMAGE",
  sticker: "IMAGE",
  video: "OTHER",
  document: "DOCUMENT",
};

/** Text shown in the thread: the body, a button title, or a media caption. */
function extractText(message: WebhookMessage): string | null {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    message.image?.caption ??
    message.video?.caption ??
    message.document?.caption ??
    message.document?.filename ??
    null
  );
}

async function findLead(db: DbClient, ownerUserId: string, phone: string): Promise<Lead | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.ownerUserId, ownerUserId), inArray(leads.phone, phoneVariants(phone))))
    .limit(1);
  return lead ?? null;
}

async function getOrCreateLead(
  db: DbClient,
  ownerUserId: string,
  phone: string,
  profileName: string | null,
): Promise<{ lead: Lead; created: boolean }> {
  const existing = await findLead(db, ownerUserId, phone);
  if (existing) return { lead: existing, created: false };

  const [created] = await db
    .insert(leads)
    .values({
      ownerUserId,
      name: profileName?.trim() || formatPhone(phone),
      phone,
      source: "WHATSAPP",
      status: "NEW",
      temperature: "WARM",
    })
    // Another webhook for the same customer may have created the lead meanwhile.
    .onConflictDoNothing({ target: [leads.ownerUserId, leads.phone] })
    .returning();
  if (created) return { lead: created, created: true };

  const raced = await findLead(db, ownerUserId, phone);
  if (!raced) throw new Error("Lead could not be created or found");
  return { lead: raced, created: false };
}

export async function getOrCreateConversation(db: DbClient, leadId: string): Promise<string> {
  const [created] = await db
    .insert(conversations)
    .values({ leadId })
    .onConflictDoNothing({ target: conversations.leadId })
    .returning({ id: conversations.id });
  if (created) return created.id;

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .limit(1);
  if (!existing) throw new Error("Conversation could not be created or found");
  return existing.id;
}

/**
 * Stores one message received from a customer, creating the lead and the
 * conversation when needed. Safe to call again with the same message: the
 * unique WhatsApp message id makes the second call a no-op.
 */
export async function saveInboundMessage(
  db: DbClient,
  input: {
    ownerUserId: string;
    message: WebhookMessage;
    profileName: string | null;
  },
): Promise<InboundResult> {
  const { ownerUserId, message, profileName } = input;
  const phone = normalizePhone(message.from);
  const timestamp = new Date(Number(message.timestamp) * 1000);

  const { lead, created } = await getOrCreateLead(db, ownerUserId, phone, profileName);
  const conversationId = await getOrCreateConversation(db, lead.id);
  const text = extractText(message);

  const [saved] = await db
    .insert(messages)
    .values({
      conversationId,
      leadId: lead.id,
      whatsappMessageId: message.id,
      direction: "INBOUND",
      type: TYPE_MAP[message.type] ?? "OTHER",
      text,
      timestamp,
      status: "RECEIVED",
      rawPayload: message,
    })
    .onConflictDoNothing({ target: messages.whatsappMessageId })
    .returning({ id: messages.id });

  // Already stored by an earlier delivery of the same webhook.
  if (!saved) return "duplicate";

  const receivedAt = sql`${timestamp.toISOString()}::timestamptz`;
  await db
    .update(leads)
    // Webhooks can arrive out of order: never move the last contact backwards.
    .set({ lastContactAt: sql`greatest(coalesce(${leads.lastContactAt}, ${receivedAt}), ${receivedAt})` })
    .where(eq(leads.id, lead.id));
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  await db.insert(leadEvents).values([
    ...(created
      ? [
          {
            leadId: lead.id,
            type: "LEAD_CREATED" as const,
            description: "Criado a partir de uma mensagem no WhatsApp.",
            createdAt: timestamp,
          },
        ]
      : []),
    { leadId: lead.id, type: "MESSAGE_RECEIVED" as const, description: text, createdAt: timestamp },
  ]);

  return "saved";
}
