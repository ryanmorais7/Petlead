import "server-only";

import { getServerEnv } from "@/lib/env";

import type { SuggestionProvider } from "./provider";
import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic";

type ProviderFactory = (config: { apiKey: string; model: string }) => SuggestionProvider;

/** Supported vendors. Adding one means implementing SuggestionProvider and listing it here. */
const PROVIDERS: Record<string, { create: ProviderFactory; defaultModel: string }> = {
  anthropic: { create: createAnthropicProvider, defaultModel: DEFAULT_ANTHROPIC_MODEL },
};

const DEFAULT_PROVIDER = "anthropic";

/**
 * The configured message generator, or null while no API key is set.
 * The app works without it: the generate buttons just explain what is missing.
 */
export function getSuggestionProvider(): SuggestionProvider | null {
  const env = getServerEnv();
  if (!env.AI_API_KEY) return null;

  const entry = PROVIDERS[(env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()];
  if (!entry) return null;

  return entry.create({ apiKey: env.AI_API_KEY, model: env.AI_MODEL ?? entry.defaultModel });
}

export function isAiConfigured(): boolean {
  return getSuggestionProvider() !== null;
}
