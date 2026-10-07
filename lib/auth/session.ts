import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/db";
import { users, type User } from "@/db/schema";

import { readAuthSecret, SESSION_COOKIE, verifySessionToken } from "./token";

/** The signed-in seller, or null when there is no valid session. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = verifySessionToken(token, readAuthSecret());
  if (!userId) return null;

  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
});

/**
 * Returns the signed-in seller or sends the visitor to the sign-in screen.
 * Every data access function and every action goes through here and scopes
 * its queries by `ownerUserId`.
 */
export async function getCurrentUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
