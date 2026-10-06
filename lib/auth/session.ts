import "server-only";

import type { User } from "@/db/schema";
import { MOCK_USER } from "@/lib/mock/dataset";

/**
 * Returns the signed-in seller. Every data access function receives the user
 * from here and scopes its queries by `ownerUserId`, so adding real sign-in
 * and more sellers later only changes this file.
 */
export async function getCurrentUser(): Promise<User> {
  return MOCK_USER;
}
