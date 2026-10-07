import { describe, expect, it } from "vitest";

import { getConversationWindow } from "@/lib/whatsapp/conversation-window";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";
import { getSendBlock } from "@/lib/whatsapp/send-policy";
import { computeSignature, isValidSignature } from "@/lib/whatsapp/signature";
import { verifySubscription } from "@/lib/whatsapp/webhook";

const HOUR = 60 * 60 * 1000;

describe("webhook verification (GET)", () => {
  const query = (token: string) =>
    new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "1158201444" });

  it("returns the challenge when the verify token matches", () => {
    expect(verifySubscription(query("my-token"), "my-token")).toEqual({ ok: true, challenge: "1158201444" });
  });

  it("refuses a wrong verify token", () => {
    expect(verifySubscription(query("wrong"), "my-token")).toEqual({ ok: false });
  });

  it("refuses everything while no verify token is configured", () => {
    expect(verifySubscription(query(""), null)).toEqual({ ok: false });
    expect(verifySubscription(query("anything"), null)).toEqual({ ok: false });
  });

  it("refuses a request that is not a subscription", () => {
    const params = new URLSearchParams({ "hub.mode": "unsubscribe", "hub.verify_token": "my-token", "hub.challenge": "1" });
    expect(verifySubscription(params, "my-token")).toEqual({ ok: false });
  });
});

describe("webhook signature", () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  const secret = "app-secret-for-tests";

  it("accepts the signature Meta would send", () => {
    expect(isValidSignature(body, computeSignature(body, secret), secret)).toBe(true);
  });

  it("rejects a signature made with another secret", () => {
    expect(isValidSignature(body, computeSignature(body, "other-secret"), secret)).toBe(false);
  });

  it("rejects a body changed after signing", () => {
    expect(isValidSignature(body.replace("[]", "[1]"), computeSignature(body, secret), secret)).toBe(false);
  });

  it("rejects missing, malformed or unconfigured signatures", () => {
    expect(isValidSignature(body, null, secret)).toBe(false);
    expect(isValidSignature(body, "sha256=zzzz", secret)).toBe(false);
    expect(isValidSignature(body, computeSignature(body, secret).replace("sha256=", "sha1="), secret)).toBe(false);
    expect(isValidSignature(body, computeSignature(body, secret), null)).toBe(false);
  });
});

describe("24-hour conversation window", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("is unknown when the customer never wrote", () => {
    expect(getConversationWindow(null, now)).toEqual({ state: "UNKNOWN", expiresAt: null });
  });

  it("is open up to 24 hours after the last customer message", () => {
    const window = getConversationWindow(new Date(now.getTime() - 23 * HOUR), now);
    expect(window.state).toBe("OPEN");
    expect(window.expiresAt).toEqual(new Date(now.getTime() + HOUR));
  });

  it("is closed exactly at 24 hours and after", () => {
    expect(getConversationWindow(new Date(now.getTime() - 24 * HOUR), now).state).toBe("CLOSED");
    expect(getConversationWindow(new Date(now.getTime() - 72 * HOUR), now).state).toBe("CLOSED");
  });
});

describe("send policy", () => {
  const active = { status: "INTERESTED", doNotContact: false } as const;

  it("allows sending inside the window when WhatsApp is connected", () => {
    expect(getSendBlock({ lead: active, window: "OPEN", configured: true })).toBeNull();
  });

  it("blocks a do-not-contact lead before anything else", () => {
    const flagged = getSendBlock({ lead: { ...active, doNotContact: true }, window: "OPEN", configured: true });
    const byStatus = getSendBlock({ lead: { status: "DO_NOT_CONTACT", doNotContact: false }, window: "OPEN", configured: false });
    expect(flagged?.code).toBe("CONTACT_BLOCKED");
    expect(byStatus?.code).toBe("CONTACT_BLOCKED");
  });

  it("explains each remaining reason", () => {
    expect(getSendBlock({ lead: active, window: "OPEN", configured: false })?.code).toBe("WHATSAPP_NOT_CONFIGURED");
    expect(getSendBlock({ lead: active, window: "CLOSED", configured: true })?.code).toBe("WINDOW_CLOSED");
    expect(getSendBlock({ lead: active, window: "UNKNOWN", configured: true })?.code).toBe("WINDOW_UNKNOWN");
  });

  it("lets the seller answer a customer who already closed", () => {
    expect(getSendBlock({ lead: { status: "CLOSED", doNotContact: false }, window: "OPEN", configured: true })).toBeNull();
  });
});

describe("phone numbers", () => {
  it("keeps digits only", () => {
    expect(normalizePhone("+55 (11) 98888-7777")).toBe("5511988887777");
  });

  it("matches Brazilian mobiles with and without the ninth digit", () => {
    expect(phoneVariants("5511988887777")).toEqual(["5511988887777", "551188887777"]);
    expect(phoneVariants("551188887777")).toEqual(["551188887777", "5511988887777"]);
  });

  it("leaves landlines and foreign numbers alone", () => {
    expect(phoneVariants("551133334444")).toEqual(["551133334444"]);
    expect(phoneVariants("14155550123")).toEqual(["14155550123"]);
  });
});
