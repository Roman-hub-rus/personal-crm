import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { buildTestDatabaseUrl } from "./src/db/test-database";
import { VITEST_DATABASE_SUFFIX } from "./vitest.database";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // "server-only" throws outside Next.js; the modules that import it are also used by tests.
      { find: "server-only", replacement: fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The database is shared across test files, so they must not run at the same time.
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    env: { DATABASE_URL: buildTestDatabaseUrl(VITEST_DATABASE_SUFFIX) },
  },
});
