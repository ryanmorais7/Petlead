import { Flame, Snowflake, ThermometerSun } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { LeadStatus, LeadTemperature } from "@/lib/domain/enums";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  TEMPERATURE_LABELS,
  TEMPERATURE_TONES,
} from "@/lib/domain/labels";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge tone={LEAD_STATUS_TONES[status]} dot>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

const TEMPERATURE_ICONS = { HOT: Flame, WARM: ThermometerSun, COLD: Snowflake } as const;

export function TemperatureBadge({ temperature }: { temperature: LeadTemperature }) {
  const Icon = TEMPERATURE_ICONS[temperature];
  return (
    <Badge tone={TEMPERATURE_TONES[temperature]}>
      <Icon className="size-3" aria-hidden />
      {TEMPERATURE_LABELS[temperature]}
    </Badge>
  );
}
