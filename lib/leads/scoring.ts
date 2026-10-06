import type { LeadTemperature } from "@/lib/domain/enums";
import { clamp } from "@/lib/utils";

/**
 * Lead score (0-100). It is a recommendation for the seller's attention and is
 * never, by itself, a reason to send a message automatically.
 */

export const SCORE_SIGNALS = {
  ASKED_PRICE: 12,
  ASKED_HOW_TO_HIRE: 18,
  ASKED_DOCUMENTS: 12,
  SENT_DOCUMENTS: 22,
  ASKED_PAYMENT_METHODS: 15,
  ASKED_REGISTRATION: 18,
  ASKED_LOCATION: 6,
  ASKED_SPECIFIC_BENEFITS: 8,
  REPLIED_RECENTLY: 10,
  PET_URGENCY: 15,
  SAID_WILL_THINK: -8,
  HAPPY_WITH_COMPETITOR: -20,
  REFUSED_PROPOSAL: -30,
  ASKED_NOT_TO_BE_CONTACTED: -100,
} as const satisfies Record<string, number>;

export type ScoreSignal = keyof typeof SCORE_SIGNALS;

export const scoringConfig = {
  baseScore: 20,
  /** Points lost per day of silence, after the grace period. */
  silencePenaltyPerDay: 2,
  silenceGraceDays: 2,
  maxSilencePenalty: 40,
  hotThreshold: 70,
  warmThreshold: 40,
} as const;

export function computeLeadScore(input: {
  signals: readonly ScoreSignal[];
  daysSinceLastReply: number | null;
}): number {
  // A signal counts once, no matter how many times it appeared in the conversation.
  const signalPoints = [...new Set(input.signals)].reduce(
    (total, signal) => total + SCORE_SIGNALS[signal],
    0,
  );

  const silentDays = Math.max(0, (input.daysSinceLastReply ?? 0) - scoringConfig.silenceGraceDays);
  const silencePenalty = Math.min(
    silentDays * scoringConfig.silencePenaltyPerDay,
    scoringConfig.maxSilencePenalty,
  );

  return clamp(Math.round(scoringConfig.baseScore + signalPoints - silencePenalty), 0, 100);
}

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= scoringConfig.hotThreshold) return "HOT";
  if (score >= scoringConfig.warmThreshold) return "WARM";
  return "COLD";
}
