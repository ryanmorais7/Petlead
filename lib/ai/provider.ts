import type { LeadSource, LeadStatus, LeadTemperature, MessageDirection, MessageType } from "@/lib/domain/enums";

/**
 * Contract between the application and whichever language model is in use.
 * The rest of the system depends only on this interface, so swapping the
 * vendor or the model means writing one new implementation of it.
 */

export type ConversationContext = {
  /** Current moment, as an ISO string, and its weekday in Portuguese. */
  now: string;
  weekday: string;
  seller: { firstName: string };
  lead: {
    name: string;
    source: LeadSource;
    status: LeadStatus;
    temperature: LeadTemperature;
    leadScore: number;
    petCount: number | null;
    petNames: string[];
    planInterest: string | null;
    mainObjection: string | null;
    notes: string | null;
    daysSinceLastContact: number | null;
    /** True when the customer wrote last and has not been answered. */
    awaitingReply: boolean;
  };
  /** Most recent messages, oldest first. */
  messages: { direction: MessageDirection; type: MessageType; text: string | null; at: string }[];
  previousSummary: string | null;
  /** Messages already suggested or sent, so the next ones do not repeat them. */
  previousSuggestions: string[];
  /** Free instruction from the seller, e.g. "gere outra versão". */
  instruction: string | null;
};

export interface SuggestionProvider {
  readonly name: string;
  /**
   * Returns the model's answer as plain data. It is not trusted: the caller
   * validates it with conversationAnalysisSchema before using anything.
   */
  analyzeConversation(context: ConversationContext): Promise<unknown>;
}
