import "server-only";

import { asc } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { AppError } from "@/lib/errors";

/**
 * Returns the signed-in seller. Every data access function receives the user
 * from here and scopes its queries by `ownerUserId`, so adding real sign-in
 * and more sellers later only changes this file.
 *
 * Until sign-in exists, the system has a single seller: the first user created.
 */
export const getCurrentUser = cache(async (): Promise<User> => {
  const [user] = await getDb().select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "No user in the database. Run `npm run db:seed`.");
  }
  return user;
});
