import "server-only";

import { AppError } from "@/lib/errors";
import { sendMessageResponseSchema } from "@/lib/validations/whatsapp";

import { whatsappRequest } from "./client";
import { normalizePhone } from "./phone";

export type SendTextInput = { to: string; text: string };
export type SendTextResult = { messageId: string };

/**
 * Sends a free-form text message. Only valid inside the 24-hour customer
 * service window; callers go through sendLeadMessage, which enforces it.
 */
export async function sendWhatsAppTextMessage({ to, text }: SendTextInput): Promise<SendTextResult> {
  const response = await whatsappRequest("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    type: "text",
    text: { preview_url: false, body: text },
  });

  const parsed = sendMessageResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError("INTEGRATION", "Unexpected response from the WhatsApp API");
  }
  return { messageId: parsed.data.messages[0].id };
}
