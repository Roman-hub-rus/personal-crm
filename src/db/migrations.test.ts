// Checks that the migration adding groups does not touch existing contacts or their data,
// by replaying it against a database that already has contacts from "before groups existed".

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { buildTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";
import { contacts } from "./schema";

// A database of its own, separate from the shared Vitest database: this test rewrites history
// (migrates in two steps) and must not interfere with other tests running against the same schema.
const SUFFIX = "_migrations_test";
const testUrl = buildTestDatabaseUrl(SUFFIX);
const { name, maintenanceUrl } = splitTestDatabaseUrl(testUrl, SUFFIX);

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function migrationFilesBeforeGroups() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  const groupsIndex = files.findIndex((file) => file.includes("_groups"));
  if (groupsIndex === -1) {
    throw new Error("No migration named *_groups found yet in drizzle/");
  }
  return files.slice(0, groupsIndex);
}

// Builds a migrations folder containing only the files (and journal entries) before the groups
// migration, so it can be applied on its own.
async function migrationsFolderBeforeGroups(filesBeforeGroups: string[]) {
  const dir = await mkdtemp(path.join(tmpdir(), "crm-migrations-"));
  await mkdir(path.join(dir, "meta"));

  const journal = JSON.parse(await readFile(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"));
  const tagsBeforeGroups = filesBeforeGroups.map((file) => file.replace(/\.sql$/, ""));
  const entriesBeforeGroups = journal.entries.filter((entry: { tag: string }) => tagsBeforeGroups.includes(entry.tag));
  await writeFile(
    path.join(dir, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries: entriesBeforeGroups }),
  );

  for (const file of filesBeforeGroups) {
    await writeFile(path.join(dir, file), await readFile(path.join(MIGRATIONS_DIR, file)));
  }

  return dir;
}

afterAll(async () => {
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.end();
  }
});

test("Существующие контакты после запуска", async () => {
  const admin = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const filesBeforeGroups = await migrationFilesBeforeGroups();
  const folderBeforeGroups = await migrationsFolderBeforeGroups(filesBeforeGroups);

  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);

    // The state of the database before the groups migration existed.
    await migrate(db, { migrationsFolder: folderBeforeGroups });
    const [{ id }] = await db
      .insert(contacts)
      .values({ name: "Борис Орлов", about: "Сосед" })
      .returning({ id: contacts.id });

    // Now apply every migration, including the one adding groups.
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

    const [contact] = await db
      .select()
      .from(contacts)
      .where(sql`${contacts.id} = ${id}`);
    expect(contact.name).toBe("Борис Орлов");
    expect(contact.about).toBe("Сосед");

    const [{ count: groupCount }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from groups`);
    expect(groupCount).toBe(0);

    const [{ count: contactGroupCount }] = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from contact_groups`,
    );
    expect(contactGroupCount).toBe(0);
  } finally {
    await client.end();
    await rm(folderBeforeGroups, { recursive: true, force: true });
  }
});
