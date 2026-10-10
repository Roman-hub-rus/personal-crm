import { defineConfig } from "@playwright/test";

import { getTestDatabaseUrl } from "./e2e/test-database";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Uses the installed Google Chrome, so no extra browser download is needed.
    channel: "chrome",
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // A production build of the app on a separate port, backed by the e2e database.
    command: `tsx e2e/prepare-database.ts && next build && next start --hostname 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/contacts/new`,
    env: { DATABASE_URL: getTestDatabaseUrl() },
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
  },
});
