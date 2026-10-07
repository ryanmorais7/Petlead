/**
 * WhatsApp customer service window: a business may send free-form messages
 * only during the 24 hours after the customer's last message. Outside of it,
 * only pre-approved templates are allowed (not implemented yet).
 */

export const CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ConversationWindowState = "OPEN" | "CLOSED" | "UNKNOWN";

export type ConversationWindow = {
  state: ConversationWindowState;
  /** Moment the window closes or closed. Null when the customer never wrote. */
  expiresAt: Date | null;
};

/**
 * @param lastInboundAt timestamp of the last message received from the customer
 */
export function getConversationWindow(lastInboundAt: Date | null, now: Date): ConversationWindow {
  // No inbound message on record: we cannot tell, and WhatsApp would refuse the send.
  if (!lastInboundAt) return { state: "UNKNOWN", expiresAt: null };

  const expiresAt = new Date(lastInboundAt.getTime() + CONVERSATION_WINDOW_MS);
  return { state: expiresAt > now ? "OPEN" : "CLOSED", expiresAt };
}

export const WINDOW_LABELS: Record<ConversationWindowState, string> = {
  OPEN: "Janela de atendimento aberta",
  CLOSED: "Fora da janela de 24h",
  UNKNOWN: "Cliente ainda não escreveu",
};
