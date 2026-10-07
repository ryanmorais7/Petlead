import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScoreMeter } from "@/components/ui/score-meter";
import type { LeadOverview } from "@/lib/data/source";
import { LEAD_SOURCE_LABELS } from "@/lib/domain/labels";
import { formatPets, formatPhone, formatRelativeDay } from "@/lib/format";

import { StatusBadge, TemperatureBadge } from "./lead-badges";

type LeadListProps = { items: LeadOverview[]; now: Date };

function lastContact(item: LeadOverview, now: Date): string {
  return item.lead.lastContactAt ? formatRelativeDay(item.lead.lastContactAt, now) : "sem contato";
}

function nextFollowup(item: LeadOverview, now: Date): string {
  return item.nextFollowup ? formatRelativeDay(item.nextFollowup.scheduledFor, now) : "—";
}

/** Table on wide screens, stacked cards on phones. */
export function LeadList({ items, now }: LeadListProps) {
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((item) => (
          <li key={item.lead.id}>
            <Link href={`/leads/${item.lead.id}`} className="block">
              <Card className="p-3.5 active:bg-zinc-50">
                <div className="flex items-center gap-3">
                  <Avatar name={item.lead.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">{item.lead.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {formatPets(item.lead.petCount, item.lead.petNames)}
                    </p>
                  </div>
                  <ScoreMeter score={item.lead.leadScore} />
                  <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={item.lead.status} />
                  <TemperatureBadge temperature={item.lead.temperature} />
                  <span className="ml-auto text-xs text-zinc-500">{lastContact(item, now)}</span>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Lead</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Temperatura</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Score</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Origem</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Último contato</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Próximo follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item) => (
                <tr key={item.lead.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${item.lead.id}`} className="group flex items-center gap-3">
                      <Avatar name={item.lead.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900 group-hover:text-brand-700">
                          {item.lead.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {formatPhone(item.lead.phone)} ·{" "}
                          {formatPets(item.lead.petCount, item.lead.petNames)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.lead.status} /></td>
                  <td className="px-4 py-3"><TemperatureBadge temperature={item.lead.temperature} /></td>
                  <td className="px-4 py-3"><ScoreMeter score={item.lead.leadScore} /></td>
                  <td className="px-4 py-3 text-zinc-600">{LEAD_SOURCE_LABELS[item.lead.source]}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{lastContact(item, now)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{nextFollowup(item, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
