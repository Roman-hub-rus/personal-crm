// Recreates the Vitest database from scratch and applies all migrations, once per test run.
// Run before `vitest run` (see the "test" script in package.json), not as a Vitest globalSetup:
// Vitest's globalSetup hook crashes on this project's combination of vite 8.3.5 and vitest 5.0.5.
// Tables are then truncated before each test (see vitest.setup.ts).

import postgres from "postgres";

import { runMigrations } from "./src/db/run-migrations";
import { buildTestDatabaseUrl, splitTestDatabaseUrl } from "./src/db/test-database";
import { VITEST_DATABASE_SUFFIX } from "./vitest.database";

async function main() {
  const testUrl = buildTestDatabaseUrl(VITEST_DATABASE_SUFFIX);
  const { name, maintenanceUrl } = splitTestDatabaseUrl(testUrl, VITEST_DATABASE_SUFFIX);

  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  // The database is new and empty, so no owner of existing data is needed.
  await runMigrations(testUrl, { migrationsFolder: "drizzle" });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
