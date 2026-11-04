// Recreates the e2e database from scratch: migrations + the same 1000 test contacts as `pnpm db:seed`,
// owned by the user with E2E_OWNER_EMAIL.
// Run by Playwright before starting the app (see playwright.config.ts).

import postgres from "postgres";

import { runMigrations } from "../src/db/run-migrations";
import { seedContacts } from "../src/db/seed-contacts";
import { E2E_OWNER_EMAIL, E2E_SEEDED_CONTACTS, splitTestDatabaseUrl } from "./test-database";

async function main() {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error("DATABASE_URL is not set for the e2e run.");
  const { name, maintenanceUrl } = splitTestDatabaseUrl(testUrl);

  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  // The database is new and empty, so no owner of existing data is needed.
  await runMigrations(testUrl, { migrationsFolder: "drizzle" });

  const { inserted } = await seedContacts(testUrl, E2E_SEEDED_CONTACTS, E2E_OWNER_EMAIL);
  console.log(`E2E database "${name}" is ready: ${inserted} contacts.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
