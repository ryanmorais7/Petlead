"use server";

import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  readAuthSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/token";
import { toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export type LoginState = { message?: string; email?: string };

// One answer for every wrong combination, so the form never reveals which e-mails exist.
const INVALID = "E-mail ou senha incorretos.";

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  if (!parsed.success) return { message: INVALID, email: typedEmail };

  const { email, password } = parsed.data;
  let userId: string;

  try {
    const secret = readAuthSecret();
    if (!secret) {
      logger.error("Sign-in unavailable: AUTH_SECRET is missing or shorter than 32 characters");
      return { message: "O acesso ainda não foi configurado neste ambiente.", email };
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      return {
        message: `Muitas tentativas. Tente novamente em ${LOCK_MINUTES} minutos.`,
        email,
      };
    }

    const valid = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !valid) {
      if (user) {
        // The counter restarts after a lock expires, so each window allows the same number of tries.
        const attempts = (user.lockedUntil ? 0 : user.failedLoginAttempts) + 1;
        const locked = attempts >= MAX_FAILED_ATTEMPTS;
        await db
          .update(users)
          .set({
            failedLoginAttempts: locked ? 0 : attempts,
            lockedUntil: locked ? sql`now() + make_interval(mins => ${LOCK_MINUTES})` : null,
          })
          .where(eq(users.id, user.id));
        logger.warn("Failed sign-in attempt", { userId: user.id, attempts, locked });
      }
      return { message: INVALID, email };
    }

    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id, secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    userId = user.id;
  } catch (error) {
    logger.error("Action failed: login", { error });
    return { message: toUserMessage(error), email };
  }

  logger.info("Signed in", { userId });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
