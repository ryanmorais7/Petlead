import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt. Only the salted hash is ever stored, in the
 * form `scrypt$<salt>$<hash>` (base64url).
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, saltText, hashText] = (stored ?? "").split("$");
  const valid = scheme === "scrypt" && Boolean(saltText) && Boolean(hashText);

  // Always derive a key, so a missing account takes as long as a wrong password.
  const salt = valid ? Buffer.from(saltText, "base64url") : Buffer.alloc(SALT_LENGTH);
  const expected = valid ? Buffer.from(hashText, "base64url") : Buffer.alloc(KEY_LENGTH);
  const key = await derive(password, salt);

  return valid && expected.length === key.length && timingSafeEqual(expected, key);
}
