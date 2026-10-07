import "server-only";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

import { getWhatsAppSendConfig } from "./config";

const GRAPH_BASE_URL = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 15_000;

type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string };

/**
 * Calls the WhatsApp Cloud API on behalf of our number. Server-only: the
 * access token never leaves this module.
 */
export async function whatsappRequest(path: string, body: unknown): Promise<unknown> {
  const config = getWhatsAppSendConfig();
  if (!config) throw new AppError("WHATSAPP_NOT_CONFIGURED", "WhatsApp credentials are missing");

  const url = `${GRAPH_BASE_URL}/${config.graphApiVersion}/${config.phoneNumberId}/${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new AppError("INTEGRATION", "WhatsApp API request failed", { cause: error });
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (json as { error?: GraphError } | null)?.error;
    // Log what Meta said, minus anything that could carry the token.
    logger.error("WhatsApp API returned an error", {
      httpStatus: response.status,
      code: error?.code,
      subcode: error?.error_subcode,
      type: error?.type,
      message: error?.message,
    });
    throw new AppError("INTEGRATION", `WhatsApp API error ${response.status}`);
  }
  return json;
}
