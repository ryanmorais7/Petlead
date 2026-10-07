/**
 * Writes the demonstration leads to the database.
 *
 *   npm run db:seed          create the seller (if none exists) and reload the demo leads
 *   npm run db:seed:clear    remove the demo leads, keeping everything else
 *
 * Only rows with the fixed demonstration ids are ever deleted.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../schema";
import { buildDemoDataset, DEMO_LEAD_IDS } from "./dataset";

config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Fill it in .env.local first.");
  }
  const db = drizzle(neon(url), { schema, casing: "snake_case" });
  const clearOnly = process.argv.includes("--clear");

  // Sales block the deletion of their lead, so they go first. Everything else cascades.
  await db.delete(schema.sales).where(inArray(schema.sales.leadId, DEMO_LEAD_IDS));
  const removed = await db
    .delete(schema.leads)
    .where(inArray(schema.leads.id, DEMO_LEAD_IDS))
    .returning({ id: schema.leads.id });

  if (clearOnly) {
    console.log(`Removed ${removed.length} demonstration leads.`);
    return;
  }

  let [owner] = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt)).limit(1);
  if (!owner) {
    [owner] = await db
      .insert(schema.users)
      .values({
        name: process.env.SEED_USER_NAME ?? "Ryan Morais",
        email: process.env.SEED_USER_EMAIL ?? "vendedor@petlead.local",
        role: "ADMIN",
      })
      .returning();
    console.log(`Created seller ${owner.name}.`);
  }

  const data = buildDemoDataset(new Date(), owner.id);

  // Parents before children, to satisfy the foreign keys.
  await db.insert(schema.leads).values(data.leads);
  await db.insert(schema.conversations).values(data.conversations);
  await db.insert(schema.messages).values(data.messages);
  await db.insert(schema.conversationSummaries).values(data.summaries);
  await db.insert(schema.aiSuggestions).values(data.suggestions);
  await db.insert(schema.followups).values(data.followups);
  await db.insert(schema.leadEvents).values(data.events);
  await db.insert(schema.sales).values(data.sales);

  console.log(
    `Seeded ${data.leads.length} leads, ${data.messages.length} messages and ${data.sales.length} sales for ${owner.name}.`,
  );
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
