import type { Lead, Message } from "@/db/schema";
import type { SuggestionType } from "@/lib/domain/enums";
import type { ConversationAnalysis } from "@/lib/validations/analysis";

/**
 * Contract between the application and whichever language model is in use.
 * The rest of the system depends only on this interface, so swapping the
 * vendor or the model means writing one new implementation of it.
 *
 * No implementation is registered yet: this stage runs on mocked suggestions.
 */

export type ConversationContext = {
  lead: Pick<
    Lead,
    | "name"
    | "status"
    | "temperature"
    | "leadScore"
    | "petCount"
    | "petNames"
    | "planInterest"
    | "mainObjection"
    | "lastContactAt"
  >;
  /** Most recent messages, oldest first. */
  messages: Pick<Message, "direction" | "type" | "text" | "timestamp">[];
  previousSummary: string | null;
  /** Follow-ups already sent, so the next one does not repeat them. */
  followupHistory: { sentAt: Date; content: string }[];
  now: Date;
};

export type ReplyRequest = ConversationContext & {
  type: SuggestionType;
  /** Free instruction from the seller, e.g. "mais curta". */
  instruction?: string;
};

export interface SuggestionProvider {
  readonly name: string;
  /** Returns raw model output; callers validate it with conversationAnalysisSchema. */
  analyzeConversation(context: ConversationContext): Promise<unknown>;
  generateReply(request: ReplyRequest): Promise<unknown>;
}

export type { ConversationAnalysis };
