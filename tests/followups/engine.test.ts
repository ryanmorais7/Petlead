import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { conversationSummaries, followups, leads, messages } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { planNextFollowup } from "@/lib/followups/engine";
import { registerManualContact } from "@/lib/followups/manual-contact";
import { saveInboundMessage } from "@/lib/whatsapp/inbound";
import { sendLeadMessage, type SendLeadMessageDeps } from "@/lib/whatsapp/send-lead-message";

import { createSeller, createTestDb, resetDb } from "../helpers/db";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START = new Date("2026-10-01T12:00:00Z");
const PHONE = "5511900000401";

describe("planning the next follow-up", () => {
  const cadenceDays = [2, 5, 10, 20, 30];

  it("starts the cadence two days after the first unanswered message", () => {
    expect(planNextFollowup({ contextual: null, lastCadenceStep: null, cadenceDays })).toMatchObject({
      inDays: 2,
      sequenceStep: 0,
    });
  });

  it("spaces each attempt further apart", () => {
    const days = [0, 1, 2, 3].map(
      (step) => planNextFollowup({ contextual: null, lastCadenceStep: step, cadenceDays })?.inDays,
    );
    expect(days).toEqual([5, 10, 20, 30]);
  });

  it("stops after the last attempt", () => {
    expect(planNextFollowup({ contextual: null, lastCadenceStep: 4, cadenceDays })).toBeNull();
  });

  it("lets what the customer said win over the cadence", () => {
    const plan = planNextFollowup({
      contextual: { inDays: 7, reason: "Pediu contato na semana que vem." },
      lastCadenceStep: 2,
      cadenceDays,
    });
    expect(plan).toEqual({ inDays: 7, reason: "Pediu contato na semana que vem.", sequenceStep: null });
  });
});

describe("follow-ups driven by the conversation", () => {
  let db: DbClient;
  let close: () => Promise<void>;
  let sellerId: string;
  let inboundCount = 0;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  beforeEach(async () => {
    await resetDb(db);
    sellerId = await createSeller(db, "Seller");
  });
  afterAll(async () => {
    await close();
  });

  const customerWrites = (at: Date, text = "Oi") =>
    saveInboundMessage(db, {
      ownerUserId: sellerId,
      profileName: "Cliente",
      message: {
        from: PHONE,
        id: `wamid.ENGINE_${(inboundCount += 1)}`,
        timestamp: String(Math.floor(at.getTime() / 1000)),
        type: "text",
        text: { body: text },
      },
    });

  async function sellerWrites(at: Date) {
    const [lead] = await db.select().from(leads);
    const deps: SendLeadMessageDeps = {
      isConfigured: () => true,
      send: async () => ({ messageId: `wamid.OUT_${at.getTime()}` }),
      now: () => at,
    };
    await sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Mensagem" }, deps);
  }

  const open = () =>
    db.select().from(followups).then((rows) => rows.filter((row) => ["PENDING", "READY", "APPROVED"].includes(row.status)));
  const statuses = () =>
    db.select().from(followups).orderBy(followups.createdAt).then((rows) => rows.map((row) => row.status));

  it("schedules the first attempt two days after the seller answers", async () => {
    await customerWrites(START);
    await sellerWrites(new Date(START.getTime() + HOUR));

    const [followup] = await open();
    expect(followup).toMatchObject({ sequenceStep: 0, status: "PENDING" });
    expect(followup.scheduledFor).toEqual(new Date(START.getTime() + HOUR + 2 * DAY));

    const [lead] = await db.select().from(leads);
    expect(lead.nextFollowupAt).toEqual(followup.scheduledFor);
  });

  it("restarts the cadence when the customer answers", async () => {
    await customerWrites(START);
    const firstReply = new Date(START.getTime() + HOUR);
    await sellerWrites(firstReply);

    // Another message before anything is due changes nothing.
    await sellerWrites(new Date(firstReply.getTime() + HOUR));
    expect(await statuses()).toEqual(["PENDING"]);

    await customerWrites(new Date(firstReply.getTime() + 2 * DAY));
    expect(await statuses()).toEqual(["CANCELLED"]);

    await sellerWrites(new Date(firstReply.getTime() + 2 * DAY + HOUR));
    const [restarted] = await open();
    expect(restarted.sequenceStep).toBe(0);
  });

  it("walks the whole cadence when the seller follows up outside the system", async () => {
    await customerWrites(START);
    let at = new Date(START.getTime() + HOUR);
    await sellerWrites(at);
    const [lead] = await db.select().from(leads);

    // Each follow-up falls outside the 24-hour window, so it is sent through
    // the WhatsApp app and registered here.
    const steps: (number | null)[] = [];
    for (const gap of [2, 5, 10, 20, 30]) {
      at = new Date(at.getTime() + gap * DAY);
      await registerManualContact(db, { userId: sellerId, leadId: lead.id, now: at });
      steps.push((await open())[0]?.sequenceStep ?? null);
    }

    // After the fifth attempt nothing else is scheduled.
    expect(steps).toEqual([1, 2, 3, 4, null]);
    expect((await statuses()).filter((status) => status === "SENT")).toHaveLength(5);

    const [updated] = await db.select().from(leads);
    expect(updated.nextFollowupAt).toBeNull();
    expect(updated.lastContactAt).toEqual(at);
  });

  it("refuses to register a contact for a do-not-contact lead", async () => {
    await customerWrites(START);
    const [lead] = await db.select().from(leads);
    await db.update(leads).set({ status: "DO_NOT_CONTACT", doNotContact: true }).where(eq(leads.id, lead.id));

    await expect(registerManualContact(db, { userId: sellerId, leadId: lead.id })).rejects.toThrow();
    expect(await db.select().from(followups)).toHaveLength(0);
  });

  it("cancels what was scheduled when the customer writes", async () => {
    await customerWrites(START);
    await sellerWrites(new Date(START.getTime() + HOUR));
    await customerWrites(new Date(START.getTime() + 3 * HOUR));

    expect(await open()).toHaveLength(0);
    const [lead] = await db.select().from(leads);
    expect(lead.nextFollowupAt).toBeNull();
  });

  it("follows the plan from the conversation instead of the cadence", async () => {
    await customerWrites(START, "Vou conversar com meu esposo");
    const [lead] = await db.select().from(leads);
    await db.insert(conversationSummaries).values({
      leadId: lead.id,
      summary: "Vai conversar com o esposo.",
      followupInDays: 3,
      followupReason: "Disse que conversaria com o esposo.",
      updatedAt: new Date(START.getTime() + 60_000),
    });

    const reply = new Date(START.getTime() + HOUR);
    await sellerWrites(reply);

    const [followup] = await open();
    expect(followup).toMatchObject({ sequenceStep: null, reason: "Disse que conversaria com o esposo." });
    expect(followup.scheduledFor).toEqual(new Date(reply.getTime() + 3 * DAY));

    // The plan is consumed: it must not be applied again to a later silence.
    const [summary] = await db.select().from(conversationSummaries);
    expect(summary.followupInDays).toBeNull();
  });

  it("ignores a plan made before the customer's last message", async () => {
    await customerWrites(START);
    const [lead] = await db.select().from(leads);
    await db.insert(conversationSummaries).values({
      leadId: lead.id,
      summary: "Plano antigo.",
      followupInDays: 9,
      updatedAt: new Date(START.getTime() - DAY),
    });

    await sellerWrites(new Date(START.getTime() + HOUR));
    const [followup] = await open();
    expect(followup.sequenceStep).toBe(0);
  });

  it("keeps a follow-up the seller postponed to a later date", async () => {
    await customerWrites(START);
    const [lead] = await db.select().from(leads);
    const later = new Date(START.getTime() + 6 * DAY);
    await db.insert(followups).values({ leadId: lead.id, scheduledFor: later, reason: "Adiado por você." });

    await sellerWrites(new Date(START.getTime() + HOUR));

    const pending = await open();
    expect(pending).toHaveLength(1);
    expect(pending[0].scheduledFor).toEqual(later);
  });

  it("never schedules a follow-up for a lead that is closed", async () => {
    await customerWrites(START);
    const [lead] = await db.select().from(leads);
    await db.update(leads).set({ status: "CLOSED" }).where(eq(leads.id, lead.id));

    await sellerWrites(new Date(START.getTime() + HOUR));

    expect(await db.select().from(followups)).toHaveLength(0);
    expect(await db.select().from(messages)).toHaveLength(2);
  });
});
