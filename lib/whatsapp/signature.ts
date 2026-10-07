import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256=";

/** Value Meta sends in `X-Hub-Signature-256` for a given raw body. */
export function computeSignature(rawBody: string, appSecret: string): string {
  return PREFIX + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

/**
 * Checks that a webhook really came from Meta. The signature covers the exact
 * bytes received, so it must be verified before the body is parsed.
 */
export function isValidSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string | null | undefined,
): boolean {
  if (!appSecret || !header || !header.startsWith(PREFIX)) return false;

  const received = Buffer.from(header.slice(PREFIX.length), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Constant-time comparison for short secrets such as the verify token. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
