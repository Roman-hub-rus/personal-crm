// Applies the migrations of ./drizzle. Used by the server (migrate.ts), by `pnpm db:migrate`
// and by the test databases, so the owner's email reaches the "users" migration the same way everywhere.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { normalizeEmail } from "../lib/email";

export type MigrationOptions = {
  migrationsFolder?: string;
  // The OWNER_EMAIL setting: the user who gets the contacts and groups that exist before sign-in.
  ownerEmail?: string;
};

// The "users" migration reads the email from this session setting (current_setting in its SQL),
// because the repository is public and the email cannot live in the migration file.
const OWNER_EMAIL_SETTING = "crm.owner_email";

// Runs the migrations on `client`, which must hold a single connection: the setting lives in the session.
// Returns how many contacts and groups were given to the owner (0 if the "users" migration was not new).
export async function applyMigrations(client: postgres.Sql, options: MigrationOptions = {}): Promise<number> {
  let ownerEmail = "";
  if (options.ownerEmail) {
    const normalized = normalizeEmail(options.ownerEmail);
    if (!normalized) {
      // Checked before the first migration step: a typo must not leave a half-done migration.
      throw new Error("OWNER_EMAIL is not a valid email address.");
    }
    ownerEmail = normalized;
  }

  const [{ fresh }] = await client<{ fresh: boolean }[]>`select to_regclass('public.users') is null as fresh`;
  await client`select set_config(${OWNER_EMAIL_SETTING}, ${ownerEmail}, false)`;
  await migrate(drizzle(client), { migrationsFolder: options.migrationsFolder ?? "./drizzle" });

  // Only the run that created the users table gave contacts and groups to the owner.
  const [{ created }] = await client<{ created: boolean }[]>`select to_regclass('public.users') is not null as created`;
  if (!fresh || !created) return 0;
  const [{ given }] = await client<{ given: number }[]>`
    select (select count(*) from contacts where owner_id is not null)::int
         + (select count(*) from groups where owner_id is not null)::int as given
  `;
  return given;
}

export async function runMigrations(databaseUrl: string, options: MigrationOptions = {}): Promise<number> {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    return await applyMigrations(client, options);
  } finally {
    await client.end();
  }
}
