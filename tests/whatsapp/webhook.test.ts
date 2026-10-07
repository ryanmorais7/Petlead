import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { conversations, leadEvents, leads, messages, whatsappWebhookEvents } from "@/db/schema";
import type { DbClient } from "@/db/types";
import { sendLeadMessage } from "@/lib/whatsapp/send-lead-message";
import { computeSignature } from "@/lib/whatsapp/signature";
import { handleWebhookPost, type WebhookDeps } from "@/lib/whatsapp/webhook";

import {
  createSeller,
  createTestDb,
  FIXTURE_INBOUND_AT,
  FIXTURE_OUTBOUND_ID,
  FIXTURE_PHONE,
  FIXTURE_PHONE_NUMBER_ID,
  loadFixture,
  resetDb,
} from "../helpers/db";

const APP_SECRET = "app-secret-for-tests";

let db: DbClient;
let close: () => Promise<void>;
let sellerId: string;
let deps: WebhookDeps;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

beforeEach(async () => {
  await resetDb(db);
  sellerId = await createSeller(db, "Seller");
  deps = {
    db,
    appSecret: APP_SECRET,
    phoneNumberId: FIXTURE_PHONE_NUMBER_ID,
    resolveOwnerUserId: async () => sellerId,
  };
});

afterAll(async () => {
  await close();
});

/** Delivers a fixture the way Meta would: raw body plus its signature. */
function deliver(fixture: string, overrides: Partial<WebhookDeps> = {}) {
  const body = loadFixture(fixture);
  return handleWebhookPost(body, computeSignature(body, APP_SECRET), { ...deps, ...overrides });
}

describe("webhook authentication (POST)", () => {
  it("processes a correctly signed request", async () => {
    expect((await deliver("inbound-text")).status).toBe(200);
  });

  it("rejects an invalid signature and stores nothing", async () => {
    const body = loadFixture("inbound-text");
    const response = await handleWebhookPost(body, computeSignature(body, "wrong-secret"), deps);

    expect(response.status).toBe(401);
    expect(await db.select().from(whatsappWebhookEvents)).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("rejects a request without signature", async () => {
    expect((await handleWebhookPost(loadFixture("inbound-text"), null, deps)).status).toBe(401);
  });

  it("refuses to process anything while the app secret is not configured", async () => {
    const response = await deliver("inbound-text", { appSecret: null });

    expect(response.status).toBe(503);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("acknowledges signed payloads it does not understand, without retrying", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const response = await handleWebhookPost(body, computeSignature(body, APP_SECRET), deps);

    expect(response.status).toBe(200);
    const [event] = await db.select().from(whatsappWebhookEvents);
    expect(event.status).toBe("IGNORED");
  });
});

describe("inbound messages", () => {
  it("creates the lead, the conversation and the message", async () => {
    await deliver("inbound-text");

    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({
      ownerUserId: sellerId,
      name: "Cliente Teste",
      phone: FIXTURE_PHONE,
      source: "WHATSAPP",
      status: "NEW",
      temperature: "WARM",
      doNotContact: false,
    });
    expect(lead.lastContactAt).toEqual(FIXTURE_INBOUND_AT);

    expect(await db.select().from(conversations)).toHaveLength(1);

    const [message] = await db.select().from(messages);
    expect(message).toMatchObject({
      leadId: lead.id,
      whatsappMessageId: "wamid.FIXTURE_INBOUND_1",
      direction: "INBOUND",
      type: "TEXT",
      status: "RECEIVED",
      text: "Oi, queria saber sobre o plano para o meu cachorro",
    });
    expect(message.timestamp).toEqual(FIXTURE_INBOUND_AT);

    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, lead.id));
    expect(events.map((event) => event.type).sort()).toEqual(["LEAD_CREATED", "MESSAGE_RECEIVED"]);

    const [logged] = await db.select().from(whatsappWebhookEvents);
    expect(logged).toMatchObject({ status: "PROCESSED", signatureValid: true });
  });

  it("reuses the lead and the conversation for the next message", async () => {
    await deliver("inbound-text");
    await deliver("inbound-followup");

    expect(await db.select().from(leads)).toHaveLength(1);
    expect(await db.select().from(conversations)).toHaveLength(1);

    const stored = await db.select().from(messages).orderBy(messages.timestamp);
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({ type: "IMAGE", text: "Esse é o Thor" });

    const [lead] = await db.select().from(leads);
    expect(lead.lastContactAt).toEqual(new Date(1790000600 * 1000));
  });

  it("never stores the same message twice", async () => {
    await deliver("inbound-text");
    const second = await deliver("inbound-duplicate");
    const third = await deliver("inbound-duplicate");

    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(await db.select().from(messages)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
    expect(await db.select().from(leadEvents)).toHaveLength(2);
    // Every delivery is logged, even when it changes nothing.
    expect(await db.select().from(whatsappWebhookEvents)).toHaveLength(3);
  });

  it("does not move the last contact backwards when webhooks arrive out of order", async () => {
    await deliver("inbound-followup");
    await deliver("inbound-text");

    const [lead] = await db.select().from(leads);
    expect(lead.lastContactAt).toEqual(new Date(1790000600 * 1000));
  });

  it("matches a lead stored under the other spelling of a Brazilian mobile number", async () => {
    // Same number as the fixture, without the ninth digit.
    await db.insert(leads).values({ ownerUserId: sellerId, name: "Maria", phone: "551100000201" });
    await deliver("inbound-text");

    const stored = await db.select().from(leads);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Maria");
  });

  it("keeps a do-not-contact lead blocked when the customer writes again", async () => {
    await db
      .insert(leads)
      .values({ ownerUserId: sellerId, name: "Sônia", phone: FIXTURE_PHONE, status: "DO_NOT_CONTACT", doNotContact: true });
    await deliver("inbound-text");

    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({ status: "DO_NOT_CONTACT", doNotContact: true });
    expect(await db.select().from(messages)).toHaveLength(1);
  });

  it("ignores events addressed to another phone number", async () => {
    const response = await deliver("inbound-text", { phoneNumberId: "999999999999999" });

    expect(response.status).toBe(200);
    expect(await db.select().from(leads)).toHaveLength(0);
    const [event] = await db.select().from(whatsappWebhookEvents);
    expect(event.status).toBe("IGNORED");
  });

  it("answers 500 so Meta retries when processing fails", async () => {
    const response = await deliver("inbound-text", { resolveOwnerUserId: async () => null });

    expect(response.status).toBe(500);
    const [event] = await db.select().from(whatsappWebhookEvents);
    expect(event.status).toBe("FAILED");
    expect(event.error).toBeTruthy();
  });
});

describe("delivery receipts", () => {
  /** Receives a customer message and answers it, so there is an outbound message to track. */
  async function sendReply(): Promise<string> {
    await deliver("inbound-text");
    const [lead] = await db.select().from(leads);
    const { messageId } = await sendLeadMessage(
      db,
      { userId: sellerId, leadId: lead.id, text: "Oi! Claro, te explico." },
      {
        isConfigured: () => true,
        send: async () => ({ messageId: FIXTURE_OUTBOUND_ID }),
        now: () => new Date(FIXTURE_INBOUND_AT.getTime() + 60_000),
      },
    );
    return messageId;
  }

  const statusOf = async (id: string) =>
    (await db.select({ status: messages.status }).from(messages).where(eq(messages.id, id)))[0].status;

  it("marks the message as delivered and then read", async () => {
    const id = await sendReply();
    expect(await statusOf(id)).toBe("SENT");

    await deliver("message-delivered");
    expect(await statusOf(id)).toBe("DELIVERED");

    await deliver("message-read");
    expect(await statusOf(id)).toBe("READ");
  });

  it("never downgrades a read message when a late receipt arrives", async () => {
    const id = await sendReply();
    await deliver("message-read");
    await deliver("message-delivered");

    expect(await statusOf(id)).toBe("READ");
  });

  it("marks a failed delivery", async () => {
    const id = await sendReply();
    const body = loadFixture("message-delivered").replace('"delivered"', '"failed"');
    await handleWebhookPost(body, computeSignature(body, APP_SECRET), deps);

    expect(await statusOf(id)).toBe("FAILED");
  });

  it("ignores receipts for messages it does not know, and never touches inbound ones", async () => {
    await deliver("inbound-text");
    const response = await deliver("message-read");

    expect(response.status).toBe(200);
    const [inbound] = await db.select().from(messages);
    expect(inbound.status).toBe("RECEIVED");
  });
});
