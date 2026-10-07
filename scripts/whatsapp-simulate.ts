/**
 * Delivers a webhook fixture to a local server, signed exactly like Meta would.
 *
 *   npm run whatsapp:simulate -- inbound-text
 *   npm run whatsapp:simulate -- message-delivered --url http://localhost:3000
 *
 * It is a development tool, not a way around the signature check: it needs the
 * same WHATSAPP_APP_SECRET the server uses, and it only talks to localhost.
 * The server writes to whatever database its DATABASE_URL points to.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

import { computeSignature } from "../lib/whatsapp/signature";

config({ path: ".env.local", quiet: true });

const FIXTURES_DIR = path.resolve("tests/fixtures/whatsapp");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function main() {
  const args = process.argv.slice(2);
  const urlFlag = args.indexOf("--url");
  const base = urlFlag >= 0 ? args[urlFlag + 1] : "http://localhost:3000";
  const name = args.find((arg, index) => !arg.startsWith("--") && index !== urlFlag + 1);

  const available = readdirSync(FIXTURES_DIR).map((file) => file.replace(/\.json$/, ""));
  if (!name || !available.includes(name)) {
    throw new Error(`Choose a fixture: ${available.join(", ")}`);
  }

  const target = new URL("/api/whatsapp/webhook", base);
  if (!LOCAL_HOSTS.has(target.hostname)) {
    throw new Error("This tool only delivers to a local server.");
  }

  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    throw new Error("Set WHATSAPP_APP_SECRET in .env.local (any value works for local tests).");
  }

  const body = readFileSync(path.join(FIXTURES_DIR, `${name}.json`), "utf8");
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": computeSignature(body, secret) },
    body,
  });

  console.log(`${name} -> HTTP ${response.status} ${await response.text()}`);
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
