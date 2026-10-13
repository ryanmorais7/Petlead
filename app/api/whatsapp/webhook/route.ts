import { asc } from "drizzle-orm";
import { after, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { analyzeLeadConversation } from "@/lib/ai/analyze-conversation";
import { getSuggestionProvider } from "@/lib/ai/config";
import { logger } from "@/lib/logger";
import { getWhatsAppWebhookConfig } from "@/lib/whatsapp/config";
import { handleWebhookPost, verifySubscription } from "@/lib/whatsapp/webhook";

/**
 * WhatsApp Business Platform webhook.
 * GET answers Meta's verification handshake; POST receives messages and
 * delivery receipts. Meta has no session, so this route is outside the
 * sign-in gate and trusts only requests signed with the App Secret.
 */

export async function GET(request: NextRequest) {
  const { verifyToken } = getWhatsAppWebhookConfig();
  const result = verifySubscription(request.nextUrl.searchParams, verifyToken);

  if (!result.ok) {
    logger.warn("WhatsApp webhook verification refused");
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(result.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * Leads created by incoming messages belong to the seller who owns the
 * connected number. With a single number, that is the first account.
 */
async function resolveOwnerUserId(): Promise<string | null> {
  const [owner] = await getDb()
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(1);
  return owner?.id ?? null;
}

/**
 * Refreshes the summary, the diagnosis and the suggested reply of each lead
 * that just wrote. A failure here never affects the stored messages: the
 * seller can still ask for a suggestion by hand.
 */
async function analyzeNewMessages(leadIds: string[]): Promise<void> {
  const provider = getSuggestionProvider();
  if (!provider) return;

  for (const leadId of leadIds) {
    try {
      await analyzeLeadConversation(getDb(), { leadId }, { provider });
    } catch (error) {
      logger.error("Conversation analysis failed after a new message", { leadId, error });
    }
  }
}

export async function POST(request: NextRequest) {
  // The signature covers the exact bytes sent, so read the body as text first.
  const rawBody = await request.text();
  const { appSecret, phoneNumberId } = getWhatsAppWebhookConfig();

  try {
    const { status, body } = await handleWebhookPost(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      {
        db: getDb(),
        appSecret,
        phoneNumberId,
        resolveOwnerUserId,
        // Meta expects a fast answer, so the analysis runs after the response is sent.
        onNewMessages: (leadIds) => after(() => analyzeNewMessages(leadIds)),
      },
    );
    return Response.json(body, { status });
  } catch (error) {
    logger.error("WhatsApp webhook failed unexpectedly", { error });
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
