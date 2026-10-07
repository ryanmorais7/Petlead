import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { aiSuggestions, leadEvents, leads, messages } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { AppError } from "@/lib/errors";
import { getOrCreateConversation } from "@/lib/whatsapp/inbound";
import { sendLeadMessage, type SendLeadMessageDeps } from "@/lib/whatsapp/send-lead-message";

import { createSeller, createTestDb, resetDb } from "../helpers/db";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-07T15:00:00Z");

let db: DbClient;
let close: () => Promise<void>;
let sellerId: string;
let send: ReturnType<typeof vi.fn<SendLeadMessageDeps["send"]>>;
let deps: SendLeadMessageDeps;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

beforeEach(async () => {
  await resetDb(db);
  sellerId = await createSeller(db, "Seller");
  send = vi.fn<SendLeadMessageDeps["send"]>(async () => ({ messageId: "wamid.SENT_1" }));
  deps = { isConfigured: () => true, send, now: () => NOW };
});

afterAll(async () => {
  await close();
});

/** Creates a lead whose customer last wrote the given number of hours ago (null = never). */
async function createLead(options: {
  ownerUserId?: string;
  inboundHoursAgo?: number | null;
  values?: Partial<typeof leads.$inferInsert>;
} = {}) {
  const { ownerUserId = sellerId, inboundHoursAgo = 1, values = {} } = options;
  const [lead] = await db
    .insert(leads)
    .values({ ownerUserId, name: "Cliente", phone: "5511900000301", ...values })
    .returning();

  if (inboundHoursAgo !== null) {
    const conversationId = await getOrCreateConversation(db, lead.id);
    await db.insert(messages).values({
      conversationId,
      leadId: lead.id,
      whatsappMessageId: `wamid.IN_${lead.id}`,
      direction: "INBOUND",
      type: "TEXT",
      text: "Oi",
      timestamp: new Date(NOW.getTime() - inboundHoursAgo * HOUR),
      status: "RECEIVED",
    });
  }
  return lead;
}

const outbound = (leadId: string) =>
  db.select().from(messages).where(eq(messages.leadId, leadId)).then((rows) => rows.filter((row) => row.direction === "OUTBOUND"));

async function expectBlocked(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((error) => error instanceof AppError && error.code === code);
  expect(send).not.toHaveBeenCalled();
}

describe("sending a message to a lead", () => {
  it("sends to the phone stored on the lead and records the message", async () => {
    const lead = await createLead();
    await sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "  Olá, tudo bem?  " }, deps);

    expect(send).toHaveBeenCalledExactlyOnceWith({ to: "5511900000301", text: "Olá, tudo bem?" });

    const [message] = await outbound(lead.id);
    expect(message).toMatchObject({
      direction: "OUTBOUND",
      type: "TEXT",
      text: "Olá, tudo bem?",
      status: "SENT",
      whatsappMessageId: "wamid.SENT_1",
    });

    const [updated] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(updated.lastContactAt).toEqual(NOW);
    expect(updated.status).toBe("CONTACTED");

    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, lead.id));
    expect(events).toMatchObject([{ type: "MESSAGE_SENT", userId: sellerId }]);
  });

  it("keeps the status of a lead that is already past the first contact", async () => {
    const lead = await createLead({ values: { status: "WAITING_FAMILY" } });
    await sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps);

    const [updated] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(updated.status).toBe("WAITING_FAMILY");
  });

  it("blocks a do-not-contact lead", async () => {
    const lead = await createLead({ values: { status: "DO_NOT_CONTACT", doNotContact: true } });

    await expectBlocked(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps), "CONTACT_BLOCKED");
    expect(await outbound(lead.id)).toHaveLength(0);
  });

  it("blocks a lead that belongs to another seller", async () => {
    const otherSeller = await createSeller(db, "Other");
    const lead = await createLead({ ownerUserId: otherSeller });

    await expectBlocked(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps), "NOT_FOUND");
    expect(await outbound(lead.id)).toHaveLength(0);
  });

  it("blocks free-form messages outside the 24-hour window", async () => {
    const lead = await createLead({ inboundHoursAgo: 25 });

    await expectBlocked(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps), "WINDOW_CLOSED");
  });

  it("blocks a lead whose customer never wrote", async () => {
    const lead = await createLead({ inboundHoursAgo: null });

    await expectBlocked(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps), "WINDOW_UNKNOWN");
  });

  it("allows sending just before the window closes", async () => {
    const lead = await createLead({ inboundHoursAgo: 23.9 });
    await sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps);

    expect(send).toHaveBeenCalledOnce();
  });

  it("returns a configuration error while WhatsApp is not connected", async () => {
    const lead = await createLead();

    await expectBlocked(
      sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, { ...deps, isConfigured: () => false }),
      "WHATSAPP_NOT_CONFIGURED",
    );
    expect(await outbound(lead.id)).toHaveLength(0);
  });

  it("rejects an empty message", async () => {
    const lead = await createLead();

    await expect(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "   " }, deps)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("records the failure when WhatsApp refuses the message", async () => {
    const lead = await createLead();
    send.mockRejectedValueOnce(new AppError("INTEGRATION", "boom"));

    await expect(sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi" }, deps)).rejects.toThrow("boom");

    const [message] = await outbound(lead.id);
    expect(message).toMatchObject({ status: "FAILED", whatsappMessageId: null });
    const [unchanged] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(unchanged.status).toBe("NEW");
  });

  it("marks an approved suggestion as sent and keeps the seller's edit", async () => {
    const lead = await createLead();
    const [suggestion] = await db
      .insert(aiSuggestions)
      .values({ leadId: lead.id, type: "REPLY", content: "Texto original" })
      .returning();

    await sendLeadMessage(
      db,
      { userId: sellerId, leadId: lead.id, text: "Texto editado", suggestionId: suggestion.id },
      deps,
    );

    const [stored] = await db.select().from(aiSuggestions);
    expect(stored).toMatchObject({ approved: true, editedContent: "Texto editado" });
    expect(stored.sentAt).toEqual(NOW);
  });

  it("does not mark a suggestion that belongs to another lead", async () => {
    const lead = await createLead();
    const other = await createLead({ values: { phone: "5511900000302" } });
    const [suggestion] = await db
      .insert(aiSuggestions)
      .values({ leadId: other.id, type: "REPLY", content: "Outra" })
      .returning();

    await sendLeadMessage(db, { userId: sellerId, leadId: lead.id, text: "Oi", suggestionId: suggestion.id }, deps);

    const [stored] = await db.select().from(aiSuggestions);
    expect(stored).toMatchObject({ approved: false, sentAt: null });
  });
});
