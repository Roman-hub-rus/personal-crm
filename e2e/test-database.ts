import { buildTestDatabaseUrl, splitTestDatabaseUrl as splitTestDatabaseUrlWithSuffix } from "../src/db/test-database";

// E2E tests run against a separate database next to the main one (e.g. "crm" -> "crm_e2e"),
// so they never touch real contacts.
export const TEST_DATABASE_SUFFIX = "_e2e";

// The e2e database is filled with the same test contacts as `pnpm db:seed`.
export const E2E_SEEDED_CONTACTS = 1000;

export function getTestDatabaseUrl(): string {
  return buildTestDatabaseUrl(TEST_DATABASE_SUFFIX);
}

export function splitTestDatabaseUrl(testUrl: string) {
  return splitTestDatabaseUrlWithSuffix(testUrl, TEST_DATABASE_SUFFIX);
}
