import type { DbClient } from "@/db/types";

import { analyzeLeadConversation, type AnalysisOutcome, type AnalyzeDeps } from "./analyze-conversation";

/** What the seller can ask for when a suggestion is not quite right. */
export const REPLY_INSTRUCTIONS = {
  another: "Gere versões diferentes das anteriores, com outra abordagem para o mesmo objetivo.",
} as const;

export type ReplyInstruction = keyof typeof REPLY_INSTRUCTIONS;

/**
 * Produces a new suggestion for a lead at the seller's request. It re-reads
 * the conversation, so the summary and the diagnosis are refreshed too.
 */
export function generateReply(
  db: DbClient,
  input: { leadId: string; ownerUserId: string; instruction?: ReplyInstruction },
  deps: AnalyzeDeps,
): Promise<AnalysisOutcome> {
  return analyzeLeadConversation(
    db,
    {
      leadId: input.leadId,
      ownerUserId: input.ownerUserId,
      instruction: input.instruction ? REPLY_INSTRUCTIONS[input.instruction] : undefined,
    },
    deps,
  );
}
