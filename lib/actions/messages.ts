"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendMessageRequestSchema } from "@/lib/validations/api";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import { sendLeadMessage } from "@/lib/whatsapp/send-lead-message";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send-message";

import type { ActionResult } from "./leads";

/**
 * Sends a message the seller wrote or approved. This is the only path through
 * which a message leaves the system, and it always starts from a click.
 */
export async function sendMessage(input: {
  leadId: string;
  text: string;
  suggestionId?: string;
}): Promise<ActionResult> {
  try {
    // Calling this action is the seller's explicit approval of the text.
    const request = sendMessageRequestSchema.parse({ ...input, approved: true });
    const user = await getCurrentUser();

    await sendLeadMessage(
      getDb(),
      {
        userId: user.id,
        leadId: request.leadId,
        text: request.text,
        suggestionId: request.suggestionId,
      },
      { isConfigured: isWhatsAppConfigured, send: sendWhatsAppTextMessage },
    );
  } catch (error) {
    // An expired session redirects to the sign-in screen instead of failing here.
    unstable_rethrow(error);
    logger.error("Action failed: sendMessage", { error });
    return { ok: false, message: toUserMessage(error) };
  }

  refresh();
  return { ok: true };
}
