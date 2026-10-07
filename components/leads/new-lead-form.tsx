"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { createLead, type LeadFormState } from "@/lib/actions/leads";
import { LEAD_SOURCES } from "@/lib/domain/enums";
import { LEAD_SOURCE_LABELS } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

const INPUT =
  "block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-400";

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

function Field({ name, label, error, hint, className, children }: FieldProps) {
  const id = `lead-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children({ id, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function NewLeadForm() {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field name="name" label="Nome" error={errors.name} className="sm:col-span-2">
        {(props) => (
          <input
            {...props}
            type="text"
            required
            autoComplete="off"
            defaultValue={values.name}
            className={INPUT}
          />
        )}
      </Field>

      <Field
        name="phone"
        label="WhatsApp"
        error={errors.phone}
        hint="Com DDD. Ex.: (11) 98888-7777"
      >
        {(props) => (
          <input
            {...props}
            type="tel"
            inputMode="tel"
            required
            autoComplete="off"
            defaultValue={values.phone}
            className={INPUT}
          />
        )}
      </Field>

      <Field name="source" label="Origem" error={errors.source}>
        {(props) => (
          <select {...props} defaultValue={values.source || "WHATSAPP"} className={cn(INPUT, "h-[38px]")}>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {LEAD_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="petCount" label="Quantidade de pets" error={errors.petCount}>
        {(props) => (
          <input
            {...props}
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            defaultValue={values.petCount}
            className={INPUT}
          />
        )}
      </Field>

      <Field
        name="petNames"
        label="Nomes dos pets"
        error={errors.petNames}
        hint="Separe por vírgula. Ex.: Thor, Mel"
      >
        {(props) => (
          <input {...props} type="text" autoComplete="off" defaultValue={values.petNames} className={INPUT} />
        )}
      </Field>

      <Field name="planInterest" label="Plano de interesse" error={errors.planInterest}>
        {(props) => (
          <input
            {...props}
            type="text"
            autoComplete="off"
            defaultValue={values.planInterest}
            className={INPUT}
          />
        )}
      </Field>

      <Field name="email" label="E-mail" error={errors.email}>
        {(props) => (
          <input {...props} type="email" autoComplete="off" defaultValue={values.email} className={INPUT} />
        )}
      </Field>

      <Field name="notes" label="Observações" error={errors.notes} className="sm:col-span-2">
        {(props) => <textarea {...props} rows={3} defaultValue={values.notes} className={INPUT} />}
      </Field>

      {state.message ? (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvando..." : "Salvar lead"}
        </Button>
        <Link href="/leads" className={buttonStyles({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
