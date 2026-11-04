import { defineConfig } from "@playwright/test";

import { E2E_AUTH_STATE, E2E_OWNER_EMAIL, getTestDatabaseUrl } from "./e2e/test-database";

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
  projects: [
    // Signs in as the owner of the test contacts once and saves the state of the browser.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Everything else starts signed in as the owner.
    {
      name: "app",
      testIgnore: [/auth\.setup\.ts/, /sign-in\.spec\.ts/],
      dependencies: ["setup"],
      use: { storageState: E2E_AUTH_STATE },
    },
    // Sign-in itself is tested from a browser that is not signed in.
    { name: "sign-in", testMatch: /sign-in\.spec\.ts/ },
  ],
  webServer: {
    // A production build of the app on a separate port, backed by the e2e database.
    command: `tsx e2e/prepare-database.ts && next build && next start --hostname 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/health`,
    env: {
      DATABASE_URL: getTestDatabaseUrl(),
      // Sign-in settings for e2e. Not secrets: the email goes to the local Mailpit only.
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
      BETTER_AUTH_URL: `http://127.0.0.1:${PORT}`,
      SMTP_URL: "smtp://127.0.0.1:1025",
      MAIL_FROM: "noreply@localhost",
      OWNER_EMAIL: E2E_OWNER_EMAIL,
    },
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
  },
});
