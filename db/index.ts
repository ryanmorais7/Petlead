import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { getServerEnv } from "@/lib/env";

import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Returns the shared database client. Created lazily so the app can build and
 * run on mocked data before a database is provisioned.
 */
export function getDb(): Database {
  if (!instance) {
    const { DATABASE_URL } = getServerEnv();
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured.");
    }
    instance = drizzle(neon(DATABASE_URL), { schema, casing: "snake_case" });
  }
  return instance;
}

export { schema };
