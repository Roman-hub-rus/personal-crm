import postgres from "postgres";

import { getTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";

// Drops the e2e database after the run; the main database is never touched.
export default async function globalTeardown() {
  const { name, maintenanceUrl } = splitTestDatabaseUrl(getTestDatabaseUrl());
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  } catch (error) {
    console.warn(`Could not drop the e2e database "${name}":`, error);
  } finally {
    await admin.end();
  }
}
