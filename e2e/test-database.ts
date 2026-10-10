import { getDatabaseUrl, loadEnv } from "../src/db/env";

// E2E tests run against a separate database next to the main one (e.g. "crm" -> "crm_e2e"),
// so they never touch real contacts.
export const TEST_DATABASE_SUFFIX = "_e2e";

// The e2e database is filled with the same test contacts as `pnpm db:seed`.
export const E2E_SEEDED_CONTACTS = 1000;

export function getTestDatabaseUrl(): string {
  loadEnv();
  const url = new URL(getDatabaseUrl());
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    url.pathname = `/${encodeURIComponent(name + TEST_DATABASE_SUFFIX)}`;
  }
  return url.toString();
}

// Name of the test database and a URL of the server's maintenance database used to create/drop it.
export function splitTestDatabaseUrl(testUrl: string) {
  const url = new URL(testUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(`Refusing to use "${name}" as a test database: its name must end with "${TEST_DATABASE_SUFFIX}".`);
  }
  url.pathname = "/postgres";
  return { name, maintenanceUrl: url.toString() };
}
