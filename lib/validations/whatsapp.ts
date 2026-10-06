import { z } from "zod";

/**
 * Shapes of the WhatsApp Business Platform (Cloud API) webhook.
 * Objects are loose on purpose: Meta adds fields over time and an unknown
 * field must never make us drop a customer message.
 */

/** Query string of the GET verification request sent by Meta. */
export const webhookVerificationSchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1),
  "hub.challenge": z.string().min(1),
});

export const webhookMessageSchema = z.looseObject({
  /** Customer phone number, digits only. */
  from: z.string().min(1),
  /** Unique message id (wamid). Used as the idempotency key. */
  id: z.string().min(1),
  /** Unix time in seconds, sent as a string. */
  timestamp: z.string().regex(/^\d+$/),
  type: z.string().min(1),
  text: z.looseObject({ body: z.string() }).optional(),
});
export type WebhookMessage = z.infer<typeof webhookMessageSchema>;

export const webhookStatusSchema = z.looseObject({
  id: z.string().min(1),
  status: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  recipient_id: z.string().optional(),
});

export const webhookContactSchema = z.looseObject({
  wa_id: z.string().min(1),
  profile: z.looseObject({ name: z.string().optional() }).optional(),
});

export const webhookChangeValueSchema = z.looseObject({
  messaging_product: z.literal("whatsapp"),
  metadata: z.looseObject({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string().min(1),
  }),
  contacts: z.array(webhookContactSchema).optional(),
  messages: z.array(webhookMessageSchema).optional(),
  statuses: z.array(webhookStatusSchema).optional(),
});

export const webhookPayloadSchema = z.looseObject({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.looseObject({
      id: z.string(),
      changes: z.array(
        z.looseObject({
          field: z.string(),
          value: webhookChangeValueSchema,
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
