import { and, desc, eq } from "drizzle-orm";

import { leadEvents, leads, messages } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { AppError } from "@/lib/errors";
import { isContactBlocked } from "@/lib/leads/contact-policy";
import { getOrCreateConversation } from "@/lib/whatsapp/inbound";

import { MANUAL_CONTACT_NOTE } from "./constants";
import { onOutboundMessage } from "./engine";

/**
 * Records that the seller talked to the customer outside the system, for
 * example through the "Abrir no WhatsApp" link when the 24-hour window is
 * closed. Without this the lead would stay in today's queue forever.
 *
 * A note is added to the conversation, the due follow-up is marked as sent and
 * the next one is scheduled, exactly as if the message had gone through here.
 */
export async function registerManualContact(
  db: DbClient,
  input: { userId: string; leadId: string; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.ownerUserId, input.userId)))
    .limit(1);
  if (!lead) throw new AppError("NOT_FOUND", `Lead ${input.leadId} not found for user ${input.userId}`);
  if (isContactBlocked(lead)) throw new AppError("CONTACT_BLOCKED");

  const [lastInbound] = await db
    .select({ timestamp: messages.timestamp })
    .from(messages)
    .where(and(eq(messages.leadId, lead.id), eq(messages.direction, "INBOUND")))
    .orderBy(desc(messages.timestamp))
    .limit(1);

  const conversationId = await getOrCreateConversation(db, lead.id);
  await db.insert(messages).values({
    conversationId,
    leadId: lead.id,
    direction: "OUTBOUND",
    type: "OTHER",
    text: MANUAL_CONTACT_NOTE,
    timestamp: now,
    status: "SENT",
  });

  await db
    .update(leads)
    .set({ lastContactAt: now, ...(lead.status === "NEW" ? { status: "CONTACTED" as const } : {}) })
    .where(eq(leads.id, lead.id));

  await db.insert(leadEvents).values({
    leadId: lead.id,
    userId: input.userId,
    type: "MESSAGE_SENT",
    description: MANUAL_CONTACT_NOTE,
    createdAt: now,
  });

  await onOutboundMessage(db, {
    lead,
    userId: input.userId,
    lastInboundAt: lastInbound?.timestamp ?? null,
    now,
  });
}
