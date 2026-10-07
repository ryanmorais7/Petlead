import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless session token: `<payload>.<signature>`, signed with AUTH_SECRET.
 * It only proves who signed in; every request still loads the user from the
 * database before touching any data.
 */

export const SESSION_COOKIE = "petlead_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const MIN_SECRET_LENGTH = 32;

type SessionPayload = { sub: string; exp: number };

/** Returns the signing secret, or null when it is missing or too weak to use. */
export function readAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { sub: userId, exp: now + SESSION_MAX_AGE_SECONDS * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret).toString("base64url")}`;
}

/** Returns the user id of a valid, unexpired token. Null for anything else. */
export function verifySessionToken(
  token: string | undefined,
  secret: string | null,
  now = Date.now(),
): string | null {
  if (!token || !secret) return null;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = sign(encoded, secret);
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp > now ? payload.sub : null;
  } catch {
    return null;
  }
}
