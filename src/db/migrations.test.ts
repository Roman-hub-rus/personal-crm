// Checks that the migrations adding a feature do not touch existing contacts or their data,
// by replaying them against a database that already has contacts from "before the feature existed".

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { keepInTouchSql } from "./keep-in-touch-sql";
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

// Migrates a fresh database up to the given migration, lets `before` add data, then applies every
// migration and hands the database to `after`.
async function migrateAcross(
  tagPart: string,
  before: (db: PostgresJsDatabase) => Promise<void>,
  after: (db: PostgresJsDatabase) => Promise<void>,
) {
  const folderBefore = await migrationsFolderBefore(tagPart);
  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folderBefore });
    await before(db);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    await after(db);
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
        [{ id }] = await db
          .insert(contacts)
          .values({ name: "Борис Орлов", about: "Сосед" })
          .returning({ id: contacts.id });
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
    );
  });
});
