import type { LeadStatus } from "@/lib/domain/enums";
import { userMessageFor, type ErrorCode } from "@/lib/errors";
import { isContactBlocked } from "@/lib/leads/contact-policy";

import type { ConversationWindowState } from "./conversation-window";

export type SendBlock = { code: ErrorCode; message: string };

type SendPolicyInput = {
  lead: { status: LeadStatus; doNotContact: boolean };
  window: ConversationWindowState;
  configured: boolean;
};

/**
 * The one rule that decides whether a free-form message may be sent.
 * The inbox uses it to explain a disabled composer, and the backend enforces
 * it again before every send.
 *
 * Closed and lost leads are not blocked: answering a customer who wrote in is
 * service, not prospecting. Only an explicit do-not-contact request blocks.
 */
export function getSendBlock({ lead, window, configured }: SendPolicyInput): SendBlock | null {
  const block = (code: ErrorCode): SendBlock => ({ code, message: userMessageFor(code) });

  if (isContactBlocked(lead)) return block("CONTACT_BLOCKED");
  if (!configured) return block("WHATSAPP_NOT_CONFIGURED");
  if (window === "UNKNOWN") return block("WINDOW_UNKNOWN");
  if (window === "CLOSED") return block("WINDOW_CLOSED");
  return null;
}
