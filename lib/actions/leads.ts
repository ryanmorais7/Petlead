"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getDb } from "@/db";
import { followups, leadEvents, leads, sales, type Lead } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { OPEN_FOLLOWUP_STATUSES } from "@/lib/domain/enums";
import { AppError, toUserMessage } from "@/lib/errors";
import { isActiveLead, isContactBlocked } from "@/lib/leads/contact-policy";
import { logger } from "@/lib/logger";
import { snoozeFollowupRequestSchema } from "@/lib/validations/api";
import { leadFormSchema, leadIdSchema } from "@/lib/validations/lead";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = [...OPEN_FOLLOWUP_STATUSES];

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Loads a lead of the signed-in seller, or fails as if it did not exist. */
async function getOwnedLead(leadId: string): Promise<{ lead: Lead; userId: string }> {
  const user = await getCurrentUser();
  const [lead] = await getDb()
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.ownerUserId, user.id)))
    .limit(1);
  if (!lead) throw new AppError("NOT_FOUND", `Lead ${leadId} not found for user ${user.id}`);
  return { lead, userId: user.id };
}

/** Runs a mutation and turns any failure into a friendly message. */
async function run(name: string, mutation: () => Promise<void>): Promise<ActionResult> {
  try {
    await mutation();
  } catch (error) {
    // An expired session redirects to the sign-in screen instead of failing here.
    unstable_rethrow(error);
    logger.error(`Action failed: ${name}`, { error });
    return { ok: false, message: toUserMessage(error) };
  }
  refresh();
  return { ok: true };
}

/** Takes the lead out of today's queue and brings it back in the given number of days. */
export async function snoozeLead(input: { leadId: string; days: number }): Promise<ActionResult> {
  return run("snoozeLead", async () => {
    const { leadId, days } = snoozeFollowupRequestSchema.parse(input);
    const { lead, userId } = await getOwnedLead(leadId);
    if (isContactBlocked(lead)) throw new AppError("CONTACT_BLOCKED");
    if (!isActiveLead(lead)) throw new AppError("VALIDATION", "Lead is not active");

    const db = getDb();
    const scheduledFor = new Date(Date.now() + days * DAY_MS);
    const [current] = await db
      .select({ id: followups.id })
      .from(followups)
      .where(and(eq(followups.leadId, leadId), inArray(followups.status, OPEN_STATUSES)))
      .orderBy(followups.scheduledFor)
      .limit(1);

    const reschedule = current
      ? db
          .update(followups)
          .set({ scheduledFor, status: "PENDING" })
          .where(eq(followups.id, current.id))
      : db
          .insert(followups)
          .values({ leadId, scheduledFor, reason: "Adiado por você.", status: "PENDING" });

    await db.batch([
      reschedule,
      db.update(leads).set({ nextFollowupAt: scheduledFor }).where(eq(leads.id, leadId)),
      db.insert(leadEvents).values({
        leadId,
        userId,
        type: "FOLLOWUP_CREATED",
        description: days === 1 ? "Contato adiado para amanhã." : `Contato adiado em ${days} dias.`,
      }),
    ]);
  });
}

/** Registers the sale and removes the lead from every contact queue. */
export async function closeLead(input: { leadId: string }): Promise<ActionResult> {
  return run("closeLead", async () => {
    const leadId = leadIdSchema.parse(input.leadId);
    const { lead, userId } = await getOwnedLead(leadId);
    if (isContactBlocked(lead)) throw new AppError("CONTACT_BLOCKED");
    if (lead.status === "CLOSED") return;

    const db = getDb();
    // Credits the sale to the last follow-up that was actually sent, if any.
    const [lastSent] = await db
      .select({ id: followups.id })
      .from(followups)
      .where(and(eq(followups.leadId, leadId), eq(followups.status, "SENT")))
      .orderBy(desc(followups.scheduledFor))
      .limit(1);

    await db.batch([
      db.update(leads).set({ status: "CLOSED", nextFollowupAt: null }).where(eq(leads.id, leadId)),
      db
        .update(followups)
        .set({ status: "CANCELLED" })
        .where(and(eq(followups.leadId, leadId), inArray(followups.status, OPEN_STATUSES))),
      db.insert(sales).values({
        leadId,
        ownerUserId: userId,
        planName: lead.planInterest,
        source: lead.source,
        followupId: lastSent?.id ?? null,
      }),
      db.insert(leadEvents).values({
        leadId,
        userId,
        type: "SALE_CLOSED",
        description: lead.planInterest,
      }),
    ]);
  });
}

/** The customer asked not to be contacted: block the lead and cancel what was scheduled. */
export async function setDoNotContact(input: { leadId: string }): Promise<ActionResult> {
  return run("setDoNotContact", async () => {
    const leadId = leadIdSchema.parse(input.leadId);
    const { lead, userId } = await getOwnedLead(leadId);
    if (isContactBlocked(lead)) return;

    const db = getDb();
    await db.batch([
      db
        .update(leads)
        .set({ status: "DO_NOT_CONTACT", doNotContact: true, nextFollowupAt: null })
        .where(eq(leads.id, leadId)),
      db
        .update(followups)
        .set({ status: "CANCELLED" })
        .where(and(eq(followups.leadId, leadId), inArray(followups.status, OPEN_STATUSES))),
      db.insert(leadEvents).values({
        leadId,
        userId,
        type: "DO_NOT_CONTACT_SET",
        description: "Marcado por você como não contatar.",
      }),
    ]);
  });
}

export type LeadFormState = {
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Echoes what was typed, so a failed submission does not clear the form. */
  values?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Creates a lead typed in by the seller. Redirects to its profile on success. */
export async function createLead(_previous: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const fields = ["name", "phone", "email", "source", "petCount", "petNames", "planInterest", "notes"];
  const values = Object.fromEntries(fields.map((field) => [field, text(formData, field)]));

  const parsed = leadFormSchema.safeParse({
    name: values.name,
    phone: values.phone,
    email: values.email || undefined,
    source: values.source,
    petCount: values.petCount === "" ? undefined : values.petCount,
    petNames: values.petNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
    planInterest: values.planInterest || undefined,
    notes: values.notes || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { message: "Revise os campos destacados.", fieldErrors, values };
  }

  let leadId: string;
  try {
    const user = await getCurrentUser();
    const db = getDb();
    const data = parsed.data;

    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.ownerUserId, user.id), eq(leads.phone, data.phone)))
      .limit(1);
    if (existing) {
      return {
        message: "Já existe um lead com este telefone.",
        fieldErrors: { phone: "Telefone já cadastrado." },
        values,
      };
    }

    const [created] = await db
      .insert(leads)
      .values({
        ownerUserId: user.id,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        source: data.source,
        petCount: data.petCount ?? (data.petNames.length > 0 ? data.petNames.length : null),
        petNames: data.petNames,
        planInterest: data.planInterest ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: leads.id });
    leadId = created.id;

    await db.insert(leadEvents).values({
      leadId,
      userId: user.id,
      type: "LEAD_CREATED",
      description: "Cadastrado manualmente.",
    });
  } catch (error) {
    unstable_rethrow(error);
    logger.error("Action failed: createLead", { error });
    return { message: toUserMessage(error), values };
  }

  redirect(`/leads/${leadId}`);
}
