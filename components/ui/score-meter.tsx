import { scoringConfig } from "@/lib/leads/scoring";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= scoringConfig.hotThreshold) return "bg-accent-500";
  if (score >= scoringConfig.warmThreshold) return "bg-amber-400";
  return "bg-sky-400";
}

type ScoreMeterProps = { score: number; className?: string };

/** Lead score as a number with a small progress bar. */
export function ScoreMeter({ score, className }: ScoreMeterProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        role="meter"
        aria-label="Score do lead"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100"
      >
        <span
          className={cn("block h-full rounded-full", scoreColor(score))}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className="text-xs font-semibold text-zinc-700 tabular-nums">{score}</span>
    </span>
  );
}
