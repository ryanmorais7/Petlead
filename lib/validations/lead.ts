import { z } from "zod";

import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/domain/enums";

export const leadIdSchema = z.uuid("Identificador de lead inválido.");

/** Keeps digits only and requires a number with country and area code. */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .min(12, "Informe o telefone com DDI e DDD.")
      .max(15, "Telefone muito longo."),
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  phone: phoneSchema,
  email: z.email("E-mail inválido.").optional().or(z.literal("").transform(() => undefined)),
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES).default("NEW"),
  temperature: z.enum(LEAD_TEMPERATURES).default("COLD"),
  petCount: z.coerce.number().int().min(0).max(50).optional(),
  petNames: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  planInterest: optionalText(120),
  mainObjection: optionalText(300),
  notes: optionalText(2000),
});
export type LeadFormInput = z.infer<typeof leadFormSchema>;

/** Query string of the leads list. Unknown or malformed values fall back to "no filter". */
export const leadFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(LEAD_STATUSES).optional().catch(undefined),
  temperature: z.enum(LEAD_TEMPERATURES).optional().catch(undefined),
  source: z.enum(LEAD_SOURCES).optional().catch(undefined),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
