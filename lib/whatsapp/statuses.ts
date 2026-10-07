import { and, eq, inArray } from "drizzle-orm";

import { messages } from "@/db/schema";
import type { DbClient } from "@/db/types";
import type { MessageStatus } from "@/lib/domain/enums";
import { logger } from "@/lib/logger";
import type { WebhookStatus } from "@/lib/validations/whatsapp";

export type StatusResult = "applied" | "ignored";

/**
 * For each incoming status, the statuses a message may currently have for the
 * update to make sense. Delivery receipts can arrive late or out of order, and
 * a message that was read must never go back to "delivered".
 */
const ALLOWED_PREVIOUS: Record<string, { next: MessageStatus; from: MessageStatus[] }> = {
  sent: { next: "SENT", from: ["PENDING"] },
  delivered: { next: "DELIVERED", from: ["PENDING", "SENT"] },
  read: { next: "READ", from: ["PENDING", "SENT", "DELIVERED"] },
  failed: { next: "FAILED", from: ["PENDING", "SENT"] },
};

/** Applies a delivery receipt to the outbound message it refers to. */
export async function applyMessageStatus(db: DbClient, status: WebhookStatus): Promise<StatusResult> {
  const transition = ALLOWED_PREVIOUS[status.status];
  if (!transition) return "ignored";

  const updated = await db
    .update(messages)
    .set({ status: transition.next })
    .where(
      and(
        eq(messages.whatsappMessageId, status.id),
        eq(messages.direction, "OUTBOUND"),
        inArray(messages.status, transition.from),
      ),
    )
    .returning({ id: messages.id });

  if (updated.length === 0) return "ignored";

  if (transition.next === "FAILED") {
    logger.warn("WhatsApp reported a failed delivery", {
      messageId: updated[0].id,
      errors: status.errors?.map((error) => ({ code: error.code, title: error.title })),
    });
  }
  return "applied";
}
