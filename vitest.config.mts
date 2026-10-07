import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // "server-only" throws outside the Next.js server build; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The in-memory database takes a moment to start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
