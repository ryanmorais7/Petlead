import { Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { Button, buttonStyles } from "@/components/ui/button";
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/domain/enums";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, TEMPERATURE_LABELS } from "@/lib/domain/labels";
import type { LeadFilters } from "@/lib/validations/lead";

const FIELD =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

type SelectProps = {
  name: string;
  label: string;
  value: string | undefined;
  options: readonly string[];
  labels: Record<string, string>;
};

function FilterSelect({ name, label, value, options, labels }: SelectProps) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={FIELD}>
        <option value="">{label}: todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Filters are plain query parameters, so a filtered list can be bookmarked or shared. */
export function LeadFiltersForm({ filters }: { filters: LeadFilters }) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Form action="/leads" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
      <label className="relative block sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Buscar por nome, pet ou telefone</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Buscar por nome, pet ou telefone"
          className={`${FIELD} pl-9`}
        />
      </label>
      <FilterSelect
        name="status"
        label="Status"
        value={filters.status}
        options={LEAD_STATUSES}
        labels={LEAD_STATUS_LABELS}
      />
      <FilterSelect
        name="temperature"
        label="Temperatura"
        value={filters.temperature}
        options={LEAD_TEMPERATURES}
        labels={TEMPERATURE_LABELS}
      />
      <FilterSelect
        name="source"
        label="Origem"
        value={filters.source}
        options={LEAD_SOURCES}
        labels={LEAD_SOURCE_LABELS}
      />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" variant="primary" className="flex-1 lg:flex-none">
          Filtrar
        </Button>
        {hasFilters ? (
          <Link href="/leads" className={buttonStyles({ variant: "ghost" })}>
            <X aria-hidden />
            Limpar
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
