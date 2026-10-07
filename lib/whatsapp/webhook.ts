import { eq } from "drizzle-orm";

import { whatsappWebhookEvents } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { logger } from "@/lib/logger";
import {
  webhookChangeValueSchema,
  webhookPayloadSchema,
  type WebhookPayload,
} from "@/lib/validations/whatsapp";

import { saveInboundMessage } from "./inbound";
import { isValidSignature, safeEqual } from "./signature";
import { applyMessageStatus } from "./statuses";

/**
 * Framework-free core of the webhook endpoint. The route only reads the
 * request and hands it over, which lets the tests run the same code.
 */

export type WebhookDeps = {
  db: DbClient;
  /** App Secret of the Meta app. Without it no request can be trusted. */
  appSecret: string | null;
  /** Our own number id. Events addressed to another number are ignored. */
  phoneNumberId: string | null;
  /** Seller who receives leads created by incoming messages. */
  resolveOwnerUserId: () => Promise<string | null>;
};

export type WebhookResponse = { status: number; body: Record<string, unknown> };

export type ProcessingSummary = {
  messagesSaved: number;
  duplicates: number;
  statusesApplied: number;
  ignored: number;
};

/** GET handshake performed by Meta when the webhook URL is registered. */
export function verifySubscription(
  params: URLSearchParams,
  verifyToken: string | null,
): { ok: true; challenge: string } | { ok: false } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (!verifyToken || mode !== "subscribe" || !token || !challenge) return { ok: false };
  return safeEqual(token, verifyToken) ? { ok: true, challenge } : { ok: false };
}

export async function processWebhookPayload(
  db: DbClient,
  payload: WebhookPayload,
  context: { ownerUserId: string; phoneNumberId: string | null },
): Promise<ProcessingSummary> {
  const summary: ProcessingSummary = { messagesSaved: 0, duplicates: 0, statusesApplied: 0, ignored: 0 };

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const parsed = change.field === "messages" ? webhookChangeValueSchema.safeParse(change.value) : null;
      if (!parsed?.success) {
        summary.ignored += 1;
        continue;
      }
      const value = parsed.data;

      if (context.phoneNumberId && value.metadata.phone_number_id !== context.phoneNumberId) {
        summary.ignored += 1;
        continue;
      }

      const names = new Map(
        (value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null]),
      );

      for (const message of value.messages ?? []) {
        const result = await saveInboundMessage(db, {
          ownerUserId: context.ownerUserId,
          message,
          profileName: names.get(message.from) ?? null,
        });
        if (result === "saved") summary.messagesSaved += 1;
        else summary.duplicates += 1;
      }

      for (const status of value.statuses ?? []) {
        const result = await applyMessageStatus(db, status);
        if (result === "applied") summary.statusesApplied += 1;
        else summary.ignored += 1;
      }
    }
  }

  return summary;
}

/**
 * Handles a POST from Meta: authenticate, record, process.
 *
 * Returns 200 for anything that was authenticated and understood, including
 * events we choose to ignore, so Meta does not retry them. A processing
 * failure returns 500: Meta retries, and idempotency makes the retry safe.
 */
export async function handleWebhookPost(
  rawBody: string,
  signatureHeader: string | null,
  deps: WebhookDeps,
): Promise<WebhookResponse> {
  if (!deps.appSecret) {
    logger.warn("WhatsApp webhook received but WHATSAPP_APP_SECRET is not configured");
    return { status: 503, body: { error: "not_configured" } };
  }
  if (!isValidSignature(rawBody, signatureHeader, deps.appSecret)) {
    logger.warn("WhatsApp webhook rejected: invalid signature");
    return { status: 401, body: { error: "invalid_signature" } };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }

  const { db } = deps;
  const [event] = await db
    .insert(whatsappWebhookEvents)
    .values({ payload: json, signatureValid: true })
    .returning({ id: whatsappWebhookEvents.id });

  const finish = (status: "PROCESSED" | "IGNORED" | "FAILED", error?: string) =>
    db
      .update(whatsappWebhookEvents)
      .set({ status, error: error ?? null, processedAt: new Date() })
      .where(eq(whatsappWebhookEvents.id, event.id));

  const payload = webhookPayloadSchema.safeParse(json);
  if (!payload.success) {
    await finish("IGNORED", "Unrecognized payload shape");
    return { status: 200, body: { received: true, ignored: true } };
  }

  try {
    const ownerUserId = await deps.resolveOwnerUserId();
    if (!ownerUserId) throw new Error("No seller account to receive WhatsApp leads");

    const summary = await processWebhookPayload(db, payload.data, {
      ownerUserId,
      phoneNumberId: deps.phoneNumberId,
    });
    const nothingDone = summary.messagesSaved + summary.duplicates + summary.statusesApplied === 0;
    await finish(nothingDone ? "IGNORED" : "PROCESSED");
    logger.info("WhatsApp webhook processed", { eventId: event.id, ...summary });
    return { status: 200, body: { received: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("WhatsApp webhook processing failed", { eventId: event.id, error });
    await finish("FAILED", message).catch(() => undefined);
    return { status: 500, body: { error: "processing_failed" } };
  }
}
