import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/**
 * Any Drizzle Postgres client bound to this schema. Business logic depends on
 * this instead of a specific driver, so it runs on Neon and on the in-memory
 * database used by the tests.
 */
export type DbClient = PgDatabase<PgQueryResultHKT, typeof schema>;
