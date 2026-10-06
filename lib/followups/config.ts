import type { LeadStatus } from "@/lib/domain/enums";

/**
 * Tunable rules of the follow-up engine. Nothing here sends a message: the
 * engine only decides when a lead should come back to the seller's queue.
 */
export const followupConfig = {
  /**
   * Increasingly spaced attempts for a lead that simply stopped answering.
   * Each value is the number of days after the previous attempt.
   */
  noResponseCadenceDays: [2, 5, 10, 20, 30],

  /** After the cadence ends the lead only shows up for occasional reactivation. */
  reactivationAfterDays: 15,

  /** Age brackets of the "forgotten leads" screen, in days without contact. */
  reactivationBucketsDays: [7, 15, 30, 60],

  /** Default wait, in days, when the conversation gives context but no date. */
  contextualDelayDays: {
    WAITING_FAMILY: { min: 2, max: 3 },
    THINKING: { min: 2, max: 4 },
    COMPARING_COMPETITOR: { min: 3, max: 5 },
    WAITING_DOCUMENTS: { min: 1, max: 2 },
    WAITING_PAYMENT: { min: 1, max: 2 },
  } satisfies Partial<Record<LeadStatus, { min: number; max: number }>>,

  /** A date asked for by the customer ("me chama semana que vem") always wins. */
  respectCustomerRequestedDate: true,
} as const;

export type FollowupConfig = typeof followupConfig;
