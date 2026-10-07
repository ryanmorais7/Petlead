/**
 * Creates the seller account or updates its e-mail and password.
 *
 *   USER_EMAIL=you@example.com USER_PASSWORD='...' npm run user:set
 *
 * The password is read from the environment so it never lands in a file, and
 * only its salted hash is stored. While the system has a single seller, the
 * existing account is updated instead of creating a second one.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { hashPassword } from "../../lib/auth/password";
import * as schema from "../schema";

config({ path: ".env.local", quiet: true });

const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const password = process.env.USER_PASSWORD;
  const name = process.env.USER_NAME?.trim();

  if (!url) throw new Error("DATABASE_URL is not set. Fill it in .env.local first.");
  if (!email || !email.includes("@")) throw new Error("USER_EMAIL is missing or invalid.");
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`USER_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const db = drizzle(neon(url), { schema, casing: "snake_case" });
  const passwordHash = await hashPassword(password);
  const access = { email, passwordHash, failedLoginAttempts: 0, lockedUntil: null };

  const [byEmail] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const [first] = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt)).limit(1);
  const target = byEmail ?? first;

  if (target) {
    await db
      .update(schema.users)
      .set({ ...access, ...(name ? { name } : {}) })
      .where(eq(schema.users.id, target.id));
    console.log(`Updated access of ${name ?? target.name} <${email}>.`);
  } else {
    await db.insert(schema.users).values({ ...access, name: name ?? email.split("@")[0], role: "ADMIN" });
    console.log(`Created seller <${email}>.`);
  }
}

main().catch((error: unknown) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
