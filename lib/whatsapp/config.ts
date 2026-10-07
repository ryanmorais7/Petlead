import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * Used when WHATSAPP_GRAPH_API_VERSION is not set. Meta retires versions about
 * two years after release, so prefer setting the variable to the version
 * shown in the Meta app dashboard.
 */
export const DEFAULT_GRAPH_API_VERSION = "v23.0";

export type WhatsAppSendConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
};

/** Credentials needed to send messages, or null while the number is not connected. */
export function getWhatsAppSendConfig(): WhatsAppSendConfig | null {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return null;
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION ?? DEFAULT_GRAPH_API_VERSION,
  };
}

/** True when the app can send WhatsApp messages. The app runs fine without it. */
export function isWhatsAppConfigured(): boolean {
  return getWhatsAppSendConfig() !== null;
}

export type WhatsAppWebhookConfig = {
  verifyToken: string | null;
  appSecret: string | null;
  phoneNumberId: string | null;
};

export function getWhatsAppWebhookConfig(): WhatsAppWebhookConfig {
  const env = getServerEnv();
  return {
    verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null,
    appSecret: env.WHATSAPP_APP_SECRET ?? null,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? null,
  };
}
