// Applies pending migrations from ./drizzle on the server, where drizzle-kit is not installed.
// The Docker image bundles this file into db/migrate.mjs; locally use `pnpm db:migrate` instead.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { getDatabaseUrl, loadEnv } from "./env";

async function main() {
  loadEnv();
  const client = postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
