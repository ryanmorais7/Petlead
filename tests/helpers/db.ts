import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";
import type { DbClient } from "@/db/types";

/**
 * A real Postgres running in memory, with the project's migrations applied.
 * Tests never touch the Neon database.
 */
export async function createTestDb(): Promise<{ db: DbClient; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: path.resolve("db/migrations") });
  return { db, close: () => client.close() };
}

/** Empties every table, so each test starts from a clean database. */
export async function resetDb(db: DbClient): Promise<void> {
  await db.execute(
    sql`truncate table users, leads, conversations, messages, conversation_summaries, ai_suggestions, followups, lead_events, sales, whatsapp_webhook_events restart identity cascade`,
  );
}

export async function createSeller(db: DbClient, name: string): Promise<string> {
  const [user] = await db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.test` })
    .returning({ id: schema.users.id });
  return user.id;
}

export function loadFixture(name: string): string {
  return readFileSync(path.resolve("tests/fixtures/whatsapp", `${name}.json`), "utf8");
}

export const FIXTURE_PHONE = "5511900000201";
export const FIXTURE_PHONE_NUMBER_ID = "100000000000001";
export const FIXTURE_OUTBOUND_ID = "wamid.FIXTURE_OUTBOUND_1";
/** Timestamp of the first inbound fixture message. */
export const FIXTURE_INBOUND_AT = new Date(1790000000 * 1000);
