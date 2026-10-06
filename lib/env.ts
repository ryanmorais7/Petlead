import "server-only";

import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Server-only environment. Importing this module from a Client Component fails
 * the build, which keeps credentials out of the browser bundle.
 *
 * Integrations that are not connected yet are optional; each service checks
 * for the variables it needs before using them.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,
  WHATSAPP_GRAPH_API_VERSION: optionalString,
  AI_PROVIDER: optionalString,
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  AUTH_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      // Report which variables are wrong without ever printing their values.
      const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid environment variables: ${invalid}`);
    }
    cached = parsed.data;
  }
  return cached;
}
