import { z } from "zod";

/**
 * Shapes of the WhatsApp Business Platform (Cloud API) webhook.
 * Objects are loose on purpose: Meta adds fields over time and an unknown
 * field must never make us drop a customer message.
 */

const unixSeconds = z.string().regex(/^\d+$/);
const media = z.looseObject({ caption: z.string().optional(), filename: z.string().optional() });

export const webhookMessageSchema = z.looseObject({
  /** Customer phone number, digits only. */
  from: z.string().min(1),
  /** Unique message id (wamid). Used as the idempotency key. */
  id: z.string().min(1),
  timestamp: unixSeconds,
  type: z.string().min(1),
  text: z.looseObject({ body: z.string() }).optional(),
  image: media.optional(),
  video: media.optional(),
  document: media.optional(),
  /** Reply to a template quick-reply button. */
  button: z.looseObject({ text: z.string().optional() }).optional(),
  /** Reply to an interactive list or button message. */
  interactive: z
    .looseObject({
      button_reply: z.looseObject({ title: z.string().optional() }).optional(),
      list_reply: z.looseObject({ title: z.string().optional() }).optional(),
    })
    .optional(),
});
export type WebhookMessage = z.infer<typeof webhookMessageSchema>;

export const webhookStatusSchema = z.looseObject({
  /** Id of the message we sent. */
  id: z.string().min(1),
  status: z.string().min(1),
  timestamp: unixSeconds,
  recipient_id: z.string().optional(),
  errors: z
    .array(z.looseObject({ code: z.number().optional(), title: z.string().optional() }))
    .optional(),
});
export type WebhookStatus = z.infer<typeof webhookStatusSchema>;

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
export type WebhookChangeValue = z.infer<typeof webhookChangeValueSchema>;

export const webhookPayloadSchema = z.looseObject({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.looseObject({
      id: z.string(),
      changes: z.array(
        z.looseObject({
          field: z.string(),
          // Only the "messages" field is parsed; other subscriptions are ignored as-is.
          value: z.unknown(),
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/** Answer of the Cloud API to a successful send. */
export const sendMessageResponseSchema = z.looseObject({
  messages: z.array(z.looseObject({ id: z.string().min(1) })).min(1),
});
