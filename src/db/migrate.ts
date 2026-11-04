// Applies pending migrations from ./drizzle: `pnpm db:migrate` locally, and on the server, where drizzle-kit
// is not installed (the Docker image bundles this file into db/migrate.mjs).
// OWNER_EMAIL must be set when the database already has contacts: they go to that user (see run-migrations.ts).

import { getDatabaseUrl, getOwnerEmail, loadEnv } from "./env";
import { runMigrations } from "./run-migrations";

async function main() {
  loadEnv();
  const given = await runMigrations(getDatabaseUrl(), { ownerEmail: getOwnerEmail() });
  console.log("Migrations applied.");
  if (given > 0) {
    console.log(`Contacts and groups given to the owner: ${given}.`);
  }
}

// A failed query reports its SQL as the message; the reason (e.g. "OWNER_EMAIL is not set…") is in the cause.
function reasonOf(error: unknown): string {
  if (error instanceof Error && error.cause instanceof Error) return error.cause.message;
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(`Migration failed: ${reasonOf(error)}`);
  process.exit(1);
});
