import { z } from "zod";

import { LEAD_STATUSES } from "@/lib/domain/enums";

import { leadIdSchema } from "./lead";

/** WhatsApp text messages are limited to 4096 characters. */
const messageText = z
  .string()
  .trim()
  .min(1, "A mensagem não pode ficar vazia.")
  .max(4096, "A mensagem ultrapassa o limite do WhatsApp.");

/**
 * Body of the future "approve and send" endpoint. A message only leaves the
 * system with an explicit approval coming from the seller's screen.
 */
export const sendMessageRequestSchema = z.object({
  leadId: leadIdSchema,
  suggestionId: z.uuid().optional(),
  text: messageText,
  approved: z.literal(true, "O envio exige aprovação explícita."),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const snoozeFollowupRequestSchema = z.object({
  leadId: leadIdSchema,
  days: z.number().int().min(1).max(90),
});
export type SnoozeFollowupRequest = z.infer<typeof snoozeFollowupRequestSchema>;

export const updateLeadStatusRequestSchema = z.object({
  leadId: leadIdSchema,
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().max(300).optional(),
});
export type UpdateLeadStatusRequest = z.infer<typeof updateLeadStatusRequestSchema>;
