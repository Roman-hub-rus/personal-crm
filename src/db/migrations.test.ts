// Checks that the migrations adding a feature do not touch existing contacts or their data,
// by replaying them against a database that already has contacts from "before the feature existed".
// The "users" migration also gives the existing data to the owner, whose email comes from the settings.

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { keepInTouchSql } from "./keep-in-touch-sql";
import { applyMigrations } from "./run-migrations";
import { buildTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";
import { contacts } from "./schema";

// A database of its own, separate from the shared Vitest database: this test rewrites history
// (migrates in two steps) and must not interfere with other tests running against the same schema.
const SUFFIX = "_migrations_test";
const testUrl = buildTestDatabaseUrl(SUFFIX);
const { name, maintenanceUrl } = splitTestDatabaseUrl(testUrl, SUFFIX);

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function migrationFilesBefore(tagPart: string) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  const index = files.findIndex((file) => file.includes(tagPart));
  if (index === -1) {
    throw new Error(`No migration named *${tagPart}* found yet in drizzle/`);
  }
  return files.slice(0, index);
}

// Builds a migrations folder containing only the files (and journal entries) before the given
// migration, so they can be applied on their own.
async function migrationsFolderBefore(tagPart: string) {
  const filesBefore = await migrationFilesBefore(tagPart);
  const dir = await mkdtemp(path.join(tmpdir(), "crm-migrations-"));
  await mkdir(path.join(dir, "meta"));

  const journal = JSON.parse(await readFile(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"));
  const tagsBefore = filesBefore.map((file) => file.replace(/\.sql$/, ""));
  const entriesBefore = journal.entries.filter((entry: { tag: string }) => tagsBefore.includes(entry.tag));
  await writeFile(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: entriesBefore }));

  for (const file of filesBefore) {
    await writeFile(path.join(dir, file), await readFile(path.join(MIGRATIONS_DIR, file)));
  }

  return dir;
}

async function recreateDatabase() {
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }
}

type MigrateOptions = {
  // Email of the owner of the existing data (the OWNER_EMAIL setting).
  ownerEmail?: string;
  // Hand a failed migration to `after` instead of throwing it.
  captureError?: boolean;
};

// Migrates a fresh database up to the given migration, lets `before` add data, then applies every
// migration and hands the database to `after` (with the error, if `captureError` is set and it failed).
async function migrateAcross(
  tagPart: string,
  before: (db: PostgresJsDatabase) => Promise<void>,
  after: (db: PostgresJsDatabase, error?: Error) => Promise<void>,
  options: MigrateOptions = {},
) {
  const folderBefore = await migrationsFolderBefore(tagPart);
  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folderBefore });
    await before(db);
    let error: Error | undefined;
    try {
      await applyMigrations(client, { migrationsFolder: MIGRATIONS_DIR, ownerEmail: options.ownerEmail });
    } catch (caught) {
      if (!options.captureError) throw caught;
      error = caught as Error;
    }
    await after(db, error);
  } finally {
    await client.end();
    await rm(folderBefore, { recursive: true, force: true });
  }
}

beforeEach(recreateDatabase);

afterAll(async () => {
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.end();
  }
});

describe("groups", () => {
  test("Существующие контакты после запуска", async () => {
    let id = 0;
    await migrateAcross(
      "_groups",
      async (db) => {
        // The contacts table has no owner yet at this point, so the schema object can't be used.
        const [row] = await db.execute<{ id: number }>(
          sql`insert into contacts (name, about) values ('Борис Орлов', 'Сосед') returning id`,
        );
        id = row.id;
      },
      async (db) => {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(sql`${contacts.id} = ${id}`);
        expect(contact.name).toBe("Борис Орлов");
        expect(contact.about).toBe("Сосед");

        const [{ count: groupCount }] = await db.execute<{ count: number }>(
          sql`select count(*)::int as count from groups`,
        );
        expect(groupCount).toBe(0);

        const [{ count: contactGroupCount }] = await db.execute<{ count: number }>(
          sql`select count(*)::int as count from contact_groups`,
        );
        expect(contactGroupCount).toBe(0);
      },
      // The later "users" migration gives the existing contacts to the owner, so it needs the owner's email.
      { ownerEmail: "owner@example.com" },
    );
  });
});

describe("keep-in-touch", () => {
  test("Существующие контакты после запуска", async () => {
    // The contacts table did not have the keep-in-touch columns yet, so the schema object can't be used.
    const selectOldColumns = sql`select id, name, about, how_we_met, phone, email, notes, created_at, updated_at
      from contacts order by id`;
    let contactsBefore: Record<string, unknown>[] = [];

    await migrateAcross(
      "_keep_in_touch",
      async (db) => {
        await db.execute(sql`
          insert into contacts (name, about, how_we_met, phone, email, notes) values
            ('Анна Петрова', 'Коллега', 'На работе', '+7 900 000-00-01', 'anna@example.com', 'Обсудили отпуск'),
            ('Борис Орлов', null, null, null, null, null)
        `);
        contactsBefore = [...(await db.execute(selectOldColumns))];
      },
      async (db) => {
        expect([...(await db.execute(selectOldColumns))]).toEqual(contactsBefore);

        const stored = await db
          .select({ frequency: contacts.contactFrequency, frequencySetAt: contacts.frequencySetAt })
          .from(contacts);
        expect(stored).toEqual([
          { frequency: null, frequencySetAt: null },
          { frequency: null, frequencySetAt: null },
        ]);

        // Not one of them is in "Пора связаться".
        const { dueAt } = keepInTouchSql();
        const [{ count: dueCount }] = await db.execute<{ count: number }>(
          sql`select count(*)::int as count from contacts where ${dueAt} is not null`,
        );
        expect(dueCount).toBe(0);
      },
      { ownerEmail: "owner@example.com" },
    );
  });
});

describe("users", () => {
  // Every column of the existing tables, as the tables looked before sign-in existed.
  const selectContacts = sql`select id, name, about, how_we_met, phone, email, notes, contact_frequency,
    last_note_at, last_contacted_at, frequency_set_at, created_at, updated_at from contacts order by id`;
  const selectGroups = sql`select id, name, created_at from groups order by id`;
  const selectMemberships = sql`select contact_id, group_id from contact_groups order by contact_id, group_id`;

  type Snapshot = {
    contacts: Record<string, unknown>[];
    groups: Record<string, unknown>[];
    memberships: Record<string, unknown>[];
  };

  async function takeSnapshot(db: PostgresJsDatabase): Promise<Snapshot> {
    return {
      contacts: [...(await db.execute(selectContacts))],
      groups: [...(await db.execute(selectGroups))],
      memberships: [...(await db.execute(selectMemberships))],
    };
  }

  // Contacts with notes and "Пора связаться" moments, groups and memberships: all that existed before sign-in.
  async function addExistingData(db: PostgresJsDatabase) {
    await db.execute(sql`
      insert into contacts (name, about, how_we_met, phone, email, notes, contact_frequency,
                            last_note_at, last_contacted_at, frequency_set_at) values
        ('Анна Петрова', 'Коллега', 'На работе', '+7 900 000-00-01', 'anna@example.com', 'Обсудили отпуск',
         'month', '2026-09-01 10:00:00+00', '2026-09-05 10:00:00+00', '2026-08-01 10:00:00+00'),
        ('Борис Орлов', null, null, null, null, null, null, null, null, null),
        ('Вера Смирнова', 'Соседка', null, null, null, 'Любит теннис', 'week', null, null, '2026-10-01 10:00:00+00')
    `);
    await db.execute(sql`insert into groups (name) values ('Друзья'), ('Теннис')`);
    await db.execute(sql`insert into contact_groups (contact_id, group_id) values (1, 1), (1, 2), (3, 2)`);
  }

  async function tableExists(db: PostgresJsDatabase, table: string) {
    const [{ exists }] = await db.execute<{ exists: boolean }>(
      sql`select to_regclass(${`public.${table}`}) is not null as exists`,
    );
    return exists;
  }

  test("Владелец видит прежние данные", async () => {
    await migrateAcross(
      "_users",
      addExistingData,
      async (db) => {
        const users = await db.execute<{ id: string; email: string; email_verified: boolean }>(
          sql`select id, email, email_verified from users`,
        );
        // One user with the owner's email in lower case, and he owns everything.
        expect(users).toHaveLength(1);
        expect(users[0].email).toBe("owner@example.com");
        expect(users[0].email_verified).toBe(true);

        const ownedContacts = await db.execute<{ owner_id: string }>(sql`select owner_id from contacts`);
        expect(ownedContacts).toHaveLength(3);
        expect(ownedContacts.every((row) => row.owner_id === users[0].id)).toBe(true);

        const ownedGroups = await db.execute<{ owner_id: string }>(sql`select owner_id from groups`);
        expect(ownedGroups).toHaveLength(2);
        expect(ownedGroups.every((row) => row.owner_id === users[0].id)).toBe(true);
      },
      { ownerEmail: "  Owner@Example.COM " },
    );
  });

  test("Ни одна запись не потерялась", async () => {
    let snapshotBefore: Snapshot | undefined;
    await migrateAcross(
      "_users",
      async (db) => {
        await addExistingData(db);
        snapshotBefore = await takeSnapshot(db);
      },
      async (db) => {
        const snapshotAfter = await takeSnapshot(db);
        expect(snapshotAfter.contacts).toHaveLength(3);
        expect(snapshotAfter.groups).toHaveLength(2);
        expect(snapshotAfter.memberships).toHaveLength(3);
        // Fields, notes and "Пора связаться" moments are exactly what they were.
        expect(snapshotAfter).toEqual(snapshotBefore);
      },
      { ownerEmail: "owner@example.com" },
    );
  });

  test("Почта владельца не задана", async () => {
    let snapshotBefore: Snapshot | undefined;
    await migrateAcross(
      "_users",
      async (db) => {
        await addExistingData(db);
        snapshotBefore = await takeSnapshot(db);
      },
      async (db, error) => {
        expect(error?.message).toContain("OWNER_EMAIL");

        // The database is as it was: no user tables, no owner column, the same data.
        expect(await tableExists(db, "users")).toBe(false);
        expect(await tableExists(db, "sign_in_emails")).toBe(false);
        const ownerColumns = await db.execute(
          sql`select 1 from information_schema.columns where table_name in ('contacts', 'groups') and column_name = 'owner_id'`,
        );
        expect(ownerColumns).toHaveLength(0);
        expect(await takeSnapshot(db)).toEqual(snapshotBefore);
      },
      { captureError: true },
    );
  });

  test("Пустая база", async () => {
    await migrateAcross(
      "_users",
      async () => {},
      async (db) => {
        expect(await tableExists(db, "users")).toBe(true);
        const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from users`);
        expect(count).toBe(0);
      },
    );
  });

  test("Неверный формат почты владельца", async () => {
    await migrateAcross(
      "_users",
      addExistingData,
      async (db, error) => {
        // Refused before the first migration step: nothing changed in the database.
        expect(error?.message).toContain("OWNER_EMAIL");
        expect(await tableExists(db, "users")).toBe(false);
      },
      { ownerEmail: "not-an-email", captureError: true },
    );
  });
});
