import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { readAuthSecret } from "@/lib/auth/token";
import { logger } from "@/lib/logger";
import { getWhatsAppWebhookConfig, isWhatsAppConfigured } from "@/lib/whatsapp/config";

type HealthStatus =
  | "ok"
  | "missing_database_url"
  | "database_unreachable"
  | "missing_tables"
  | "missing_user"
  | "missing_auth_secret";

const HINTS: Record<HealthStatus, string> = {
  ok: "Tudo certo.",
  missing_database_url: "A variável DATABASE_URL não está definida neste ambiente.",
  database_unreachable: "DATABASE_URL está definida, mas a conexão com o banco falhou.",
  missing_tables: "O banco conectou, mas as tabelas não existem. Rode as migrations.",
  missing_user: "As tabelas existem, mas não há nenhum usuário. Rode npm run user:set.",
  missing_auth_secret:
    "A variável AUTH_SECRET não está definida ou tem menos de 32 caracteres. O login fica indisponível.",
};

function respond(status: HealthStatus, extra: Record<string, unknown> = {}) {
  return Response.json(
    { status, hint: HINTS[status], ...extra },
    { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Reports which setup step is missing. Returns statuses and variable names
 * only, never a value, so it is safe to leave reachable.
 */
export async function GET() {
  await connection();

  if (!process.env.DATABASE_URL) {
    // Lists similarly named variables: integrations sometimes add a prefix.
    const candidates = Object.keys(process.env)
      .filter((name) => /DATABASE_URL|POSTGRES_URL/.test(name))
      .sort();
    return respond("missing_database_url", { similarVariables: candidates });
  }

  try {
    const db = getDb();
    const tables = await db.execute<{ leads: string | null; users: string | null }>(
      sql`select to_regclass('public.leads')::text as leads, to_regclass('public.users')::text as users`,
    );
    if (!tables.rows[0]?.leads || !tables.rows[0]?.users) return respond("missing_tables");

    const counts = await db.execute<{ users: number }>(
      sql`select count(*)::int as users from users`,
    );
    if (counts.rows[0].users === 0) return respond("missing_user");
    if (!readAuthSecret()) return respond("missing_auth_secret");

    // WhatsApp is optional: the app works without it, with sending disabled.
    const webhook = getWhatsAppWebhookConfig();
    return respond("ok", {
      whatsapp: {
        sending: isWhatsAppConfigured(),
        webhookVerification: webhook.verifyToken !== null,
        webhookSignature: webhook.appSecret !== null,
      },
    });
  } catch (error) {
    logger.error("Health check failed", { error });
    return respond("database_unreachable");
  }
}
