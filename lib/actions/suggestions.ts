"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { getSuggestionProvider } from "@/lib/ai/config";
import { generateReply } from "@/lib/ai/generate-reply";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError, toUserMessage, userMessageFor } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { leadIdSchema } from "@/lib/validations/lead";

import type { ActionResult } from "./leads";

const requestSchema = z.object({
  leadId: leadIdSchema,
  instruction: z.enum(["another"]).optional(),
});

/**
 * Generates a suggested message for the seller to review. It only writes a
 * draft: sending still requires the seller's own click.
 */
export async function generateSuggestion(input: {
  leadId: string;
  instruction?: "another";
}): Promise<ActionResult> {
  try {
    const { leadId, instruction } = requestSchema.parse(input);
    const user = await getCurrentUser();

    const provider = getSuggestionProvider();
    if (!provider) throw new AppError("AI_NOT_CONFIGURED");

    const outcome = await generateReply(getDb(), { leadId, ownerUserId: user.id, instruction }, { provider });
    if (outcome !== "updated") {
      refresh();
      return {
        ok: false,
        message:
          outcome === "blocked"
            ? userMessageFor("CONTACT_BLOCKED")
            : "Este lead está encerrado. O resumo foi atualizado, mas nenhuma mensagem foi sugerida.",
      };
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.error("Action failed: generateSuggestion", { error });
    return { ok: false, message: toUserMessage(error) };
  }

  refresh();
  return { ok: true };
}
