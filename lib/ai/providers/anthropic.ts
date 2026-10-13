import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/domain/enums";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisRequest } from "../prompts";
import type { SuggestionProvider } from "../provider";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Models whose safety classifiers may decline a request and that accept a
 * server-side fallback: a declined request is re-run on the model Anthropic
 * recommends instead of failing.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MODELS_WITH_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

/**
 * Shape requested from the model. It carries no length or range limits, which
 * structured outputs do not enforce; those are checked afterwards by
 * conversationAnalysisSchema. A sale and a lost lead are the seller's call, so
 * those two statuses are not offered.
 */
const modelOutputSchema = z.object({
  intent: z.string(),
  status: z.enum(LEAD_STATUSES.filter((status) => status !== "CLOSED" && status !== "LOST")),
  temperature: z.enum(LEAD_TEMPERATURES),
  leadScore: z.number(),
  summary: z.string(),
  mainObjection: z.string().nullable(),
  recommendedAction: z.string(),
  doNotContact: z.boolean(),
  followupInDays: z.number().nullable(),
  confidence: z.number(),
  suggestions: z.object({
    recommended: z.string(),
    friendly: z.string(),
    short: z.string(),
    direct: z.string(),
    softClose: z.string(),
  }),
});

export function createAnthropicProvider(config: { apiKey: string; model: string }): SuggestionProvider {
  const client = new Anthropic({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

  return {
    name: "anthropic",

    async analyzeConversation(context) {
      try {
        const withFallback = MODELS_WITH_FALLBACK.has(config.model);
        const response = await client.beta.messages.parse({
          model: config.model,
          max_tokens: 16000,
          ...(withFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
          thinking: { type: "adaptive" },
          output_config: {
            // A short, well-specified judgement: medium effort keeps it fast without losing nuance.
            effort: "medium",
            format: betaZodOutputFormat(modelOutputSchema),
          },
          system: ANALYSIS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildAnalysisRequest(context) }],
        });

        if (response.stop_reason === "refusal") {
          logger.warn("Conversation analysis was declined", { category: response.stop_details?.category });
          throw new AppError("INTEGRATION", "The model declined the request");
        }
        if (response.stop_reason === "max_tokens" || response.parsed_output === null) {
          throw new AppError("INTEGRATION", `Incomplete analysis (stop_reason: ${response.stop_reason})`);
        }

        logger.debug("Conversation analysis usage", {
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        });
        return response.parsed_output;
      } catch (error) {
        if (error instanceof AppError) throw error;

        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new AppError("AI_NOT_CONFIGURED", "The API key was rejected", { cause: error });
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new AppError("INTEGRATION", "Rate limited by the model provider", { cause: error });
        }
        if (error instanceof Anthropic.APIError) {
          // Status and type are enough to diagnose; the message could echo request content.
          logger.error("Model provider returned an error", { status: error.status, type: error.type });
          throw new AppError("INTEGRATION", `Model provider error ${error.status}`, { cause: error });
        }
        throw new AppError("INTEGRATION", "Model provider request failed", { cause: error });
      }
    },
  };
}
